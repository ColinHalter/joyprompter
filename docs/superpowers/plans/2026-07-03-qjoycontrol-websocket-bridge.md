# QJoyControl WebSocket Bridge Implementation Plan

> ⛔ **SUPERSEDED (2026-07-03).** This plan modified QJoyControl's C++ source to add
> a WebSocket bridge. The project direction changed: QJoyControl is reference-only
> and must **not** be modified. The teleprompter now consumes QJoyControl's
> out-of-the-box output (analog-stick-as-mouse via Pointer Lock + button-to-key
> mapping). This plan is kept for history only — **do not implement it.** See
> `2026-07-03-qjoycontrol-input-source.md` for the active plan.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Source control note:** Do NOT run any git commands for this project until the user explicitly asks. The "Commit" steps below are written for completeness but must be SKIPPED until the user says otherwise. Complete the code/test/build steps normally.

**Goal:** Extend the existing QJoyControl app so it broadcasts raw Left-JoyCon input over a local WebSocket as JSON, and add a "Teleprompter Streaming Mode" toggle that suppresses the OS mouse/keyboard emulation while streaming.

**Architecture:** A new `InputWebSocketServer` (Qt `QtWebSockets`) subscribes to the existing `JoyConWorker::newInputData(QList<int>, QList<double>)` signal and broadcasts each frame as compact JSON to connected browser clients. Serialization is a pure free function (`serializeInputFrame`) so it can be unit-tested with Qt Test without hardware. A checkable menu action in `MainWindow` starts/stops the server and flips a `_teleprompter_mode` flag; when set, `MainWindow::onNewInputData` returns early so no OS keyboard/mouse events are emitted (the bridge is wired directly to the worker, so it still receives input).

**Tech Stack:** C++11, Qt (Widgets + WebSockets + Test), qmake. Builds via Qt Creator or `qmake && make`.

**Working directory:** All paths are relative to `QJoyControl/` (`/Users/chalter/CODE/prompter/QJoyControl`).

**Key facts confirmed from the existing code:**
- `newInputData` emits `button_data = { byte3, byte4, byte5 }` and `analog_data`.
- Left-stick calibrated values are `analog_data[2]` (x) and `analog_data[3]` (y), already normalized to roughly −1..1 by `AnalogStickCalc` (positive y = stick up).
- Button masks (`eventhandler.h`): in `button_data[1]` (byte4) `L_BUT_STICK = 8`; in `button_data[2]` (byte5) `L_BUT_DOWN=1, L_BUT_UP=2, L_BUT_RIGHT=4, L_BUT_LEFT=8, L_BUT_SR=16, L_BUT_SL=32`.
- `MainWindow` already has an `enableInputStreaming(bool)` signal wired to `JoyConWorker::onInputStreamingEnabled`, which starts/stops input polling.
- Port `8420` matches the teleprompter web app's `CONFIG.wsUrl`.

---

## File Structure

- `inputframejson.h` / `inputframejson.cpp` — pure `serializeInputFrame(...)` free function (new)
- `inputwebsocketserver.h` / `inputwebsocketserver.cpp` — the WebSocket broadcaster (new)
- `tests/serialize_test.pro` / `tests/tst_serialize.cpp` — Qt Test target for serialization (new)
- `QJoyControl.pro` — add `QT += websockets` and the new sources/headers (modified)
- `mainwindow.h` / `mainwindow.cpp` — server member, `_teleprompter_mode` flag, menu toggle, early-return suppression (modified)

---

## Task 1: `serializeInputFrame` pure function (TDD with Qt Test)

**Files:**
- Create: `inputframejson.h`
- Create: `inputframejson.cpp`
- Create: `tests/tst_serialize.cpp`
- Create: `tests/serialize_test.pro`

- [ ] **Step 1: Write the failing test**

Create `tests/tst_serialize.cpp`:

```cpp
#include <QtTest>
#include <QJsonDocument>
#include <QJsonObject>
#include "inputframejson.h"
#include "eventhandler.h"

class TstSerialize : public QObject {
    Q_OBJECT
private slots:
    void serializesStickAndButtons();
    void toleratesShortLists();
};

void TstSerialize::serializesStickAndButtons() {
    // button_data = { byte3, byte4, byte5 }
    // byte4 sets stick click; byte5 sets D-pad up + SR
    QList<int> buttons = { 0, L_BUT_STICK, L_BUT_UP | L_BUT_SR };
    QString json = serializeInputFrame(42, -0.5, 0.75, buttons);

    QJsonObject o = QJsonDocument::fromJson(json.toUtf8()).object();
    QCOMPARE(o["type"].toString(), QStringLiteral("input"));
    QCOMPARE(o["seq"].toInt(), 42);
    QCOMPARE(o["stick"].toObject()["x"].toDouble(), -0.5);
    QCOMPARE(o["stick"].toObject()["y"].toDouble(), 0.75);

    QJsonObject b = o["buttons"].toObject();
    QVERIFY(b["up"].toBool());
    QVERIFY(b["sr"].toBool());
    QVERIFY(b["stickClick"].toBool());
    QVERIFY(!b["down"].toBool());
    QVERIFY(!b["left"].toBool());
    QVERIFY(!b["sl"].toBool());
}

void TstSerialize::toleratesShortLists() {
    QList<int> buttons; // empty
    QString json = serializeInputFrame(0, 0.0, 0.0, buttons);
    QJsonObject b = QJsonDocument::fromJson(json.toUtf8()).object()["buttons"].toObject();
    QVERIFY(!b["up"].toBool());
    QVERIFY(!b["stickClick"].toBool());
}

QTEST_APPLESS_MAIN(TstSerialize)
#include "tst_serialize.moc"
```

- [ ] **Step 2: Create the test project file**

Create `tests/serialize_test.pro`:

```pro
QT += core testlib
QT -= gui
CONFIG += c++11 console testcase
CONFIG -= app_bundle
TARGET = tst_serialize
INCLUDEPATH += ..
SOURCES += tst_serialize.cpp ../inputframejson.cpp
HEADERS += ../inputframejson.h ../eventhandler.h
```

- [ ] **Step 3: Create the header (declaration only)**

Create `inputframejson.h`:

```cpp
#ifndef INPUTFRAMEJSON_H
#define INPUTFRAMEJSON_H

#include <QString>
#include <QList>

/*!
 * Serialize a single JoyCon input frame to the teleprompter wire format.
 * \param seq         monotonically increasing frame counter
 * \param stickX      calibrated left-stick X, normalized ~-1..1
 * \param stickY      calibrated left-stick Y, normalized ~-1..1 (positive = up)
 * \param buttonData  { byte3, byte4, byte5 } from newInputData
 */
QString serializeInputFrame(quint64 seq, double stickX, double stickY,
                            const QList<int>& buttonData);

#endif // INPUTFRAMEJSON_H
```

- [ ] **Step 4: Run the test to verify it fails**

Run:
```bash
cd tests && qmake serialize_test.pro && make
```
Expected: FAIL — link error, `serializeInputFrame` is undefined (only declared).

- [ ] **Step 5: Write the implementation**

Create `inputframejson.cpp`:

```cpp
#include "inputframejson.h"
#include "eventhandler.h"
#include <QJsonObject>
#include <QJsonDocument>

QString serializeInputFrame(quint64 seq, double stickX, double stickY,
                            const QList<int>& buttonData) {
    const int byte4 = buttonData.size() > 1 ? buttonData.at(1) : 0;
    const int byte5 = buttonData.size() > 2 ? buttonData.at(2) : 0;

    QJsonObject buttons;
    buttons["up"]         = (byte5 & L_BUT_UP) != 0;
    buttons["down"]       = (byte5 & L_BUT_DOWN) != 0;
    buttons["left"]       = (byte5 & L_BUT_LEFT) != 0;
    buttons["right"]      = (byte5 & L_BUT_RIGHT) != 0;
    buttons["sl"]         = (byte5 & L_BUT_SL) != 0;
    buttons["sr"]         = (byte5 & L_BUT_SR) != 0;
    buttons["stickClick"] = (byte4 & L_BUT_STICK) != 0;

    QJsonObject stick;
    stick["x"] = stickX;
    stick["y"] = stickY;

    QJsonObject root;
    root["type"]    = QStringLiteral("input");
    root["seq"]     = static_cast<double>(seq);
    root["stick"]   = stick;
    root["buttons"] = buttons;

    return QString::fromUtf8(QJsonDocument(root).toJson(QJsonDocument::Compact));
}
```

- [ ] **Step 6: Rebuild and run the test to verify it passes**

Run:
```bash
cd tests && make && ./tst_serialize
```
Expected: PASS — `Totals: 2 passed, 0 failed`. (On macOS the binary may be `tst_serialize.app/Contents/MacOS/tst_serialize`; the `console` + `-app_bundle` config produces a plain binary.)

- [ ] **Step 7: Commit** _(SKIP — see source-control note)_

```bash
git add inputframejson.h inputframejson.cpp tests/tst_serialize.cpp tests/serialize_test.pro
git commit -m "feat: add teleprompter input frame JSON serializer with tests"
```

---

## Task 2: `InputWebSocketServer` broadcaster

**Files:**
- Create: `inputwebsocketserver.h`
- Create: `inputwebsocketserver.cpp`

- [ ] **Step 1: Create the header**

Create `inputwebsocketserver.h`:

```cpp
#ifndef INPUTWEBSOCKETSERVER_H
#define INPUTWEBSOCKETSERVER_H

#include <QObject>
#include <QList>

class QWebSocketServer;
class QWebSocket;

/*!
 * Broadcasts JoyCon input frames to connected browser clients over a local
 * (localhost-only) WebSocket. Connect JoyConWorker::newInputData to onNewInputData.
 */
class InputWebSocketServer : public QObject {
    Q_OBJECT
public:
    explicit InputWebSocketServer(quint16 port, QObject* parent = nullptr);
    ~InputWebSocketServer();

    bool isListening() const;
    int clientCount() const;

public slots:
    void onNewInputData(QList<int> buttonData, QList<double> analogData);

private slots:
    void onNewConnection();
    void onClientDisconnected();

private:
    QWebSocketServer* _server = nullptr;
    QList<QWebSocket*> _clients;
    quint64 _seq = 0;
};

#endif // INPUTWEBSOCKETSERVER_H
```

- [ ] **Step 2: Create the implementation**

Create `inputwebsocketserver.cpp`:

```cpp
#include "inputwebsocketserver.h"
#include "inputframejson.h"

#include <QWebSocketServer>
#include <QWebSocket>
#include <QHostAddress>

InputWebSocketServer::InputWebSocketServer(quint16 port, QObject* parent)
    : QObject(parent),
      _server(new QWebSocketServer(QStringLiteral("QJoyControl Teleprompter"),
                                   QWebSocketServer::NonSecureMode, this)) {
    if (_server->listen(QHostAddress::LocalHost, port)) {
        connect(_server, &QWebSocketServer::newConnection,
                this, &InputWebSocketServer::onNewConnection);
    }
}

InputWebSocketServer::~InputWebSocketServer() {
    _server->close();
    qDeleteAll(_clients);
    _clients.clear();
}

bool InputWebSocketServer::isListening() const {
    return _server->isListening();
}

int InputWebSocketServer::clientCount() const {
    return _clients.size();
}

void InputWebSocketServer::onNewConnection() {
    QWebSocket* sock = _server->nextPendingConnection();
    connect(sock, &QWebSocket::disconnected,
            this, &InputWebSocketServer::onClientDisconnected);
    _clients.append(sock);
}

void InputWebSocketServer::onClientDisconnected() {
    QWebSocket* sock = qobject_cast<QWebSocket*>(sender());
    if (sock) {
        _clients.removeAll(sock);
        sock->deleteLater();
    }
}

void InputWebSocketServer::onNewInputData(QList<int> buttonData,
                                          QList<double> analogData) {
    if (_clients.isEmpty()) {
        ++_seq;
        return;
    }
    const double x = analogData.size() > 2 ? analogData.at(2) : 0.0;
    const double y = analogData.size() > 3 ? analogData.at(3) : 0.0;
    const QString msg = serializeInputFrame(_seq++, x, y, buttonData);
    for (QWebSocket* client : _clients) {
        client->sendTextMessage(msg);
    }
}
```

- [ ] **Step 3: Commit** _(SKIP — see source-control note)_

```bash
git add inputwebsocketserver.h inputwebsocketserver.cpp
git commit -m "feat: add InputWebSocketServer broadcaster"
```

---

## Task 3: Wire the new files into the build

**Files:**
- Modify: `QJoyControl.pro`

- [ ] **Step 1: Add the WebSockets module**

In `QJoyControl.pro`, change the line:

```pro
QT       += core gui widgets
```
to:
```pro
QT       += core gui widgets websockets
```

- [ ] **Step 2: Add the new sources and headers**

In the `SOURCES +=` block, add:

```pro
    inputframejson.cpp \
    inputwebsocketserver.cpp \
```

In the `HEADERS +=` block, add:

```pro
    inputframejson.h \
    inputwebsocketserver.h \
```

- [ ] **Step 3: Verify the app still builds (before wiring UI)**

Run (from `QJoyControl/`):
```bash
qmake QJoyControl.pro && make
```
Expected: builds successfully with the new files compiled in and `QtWebSockets` linked. (If `qmake` reports `Unknown module(s) in QT: websockets`, install the Qt WebSockets module for your Qt kit, then re-run.)

- [ ] **Step 4: Commit** _(SKIP — see source-control note)_

```bash
git add QJoyControl.pro
git commit -m "build: add websockets module and bridge sources to .pro"
```

---

## Task 4: MainWindow toggle + input suppression

**Files:**
- Modify: `mainwindow.h`
- Modify: `mainwindow.cpp`

- [ ] **Step 1: Declare the members and slot in `mainwindow.h`**

Add near the top of the class's `private slots:` section (there is already one containing `onNewInputData`):

```cpp
    void onTeleprompterModeToggled(bool on);
```

Add to the `private:` members section (near `EventHandler* _event_handler`):

```cpp
    class InputWebSocketServer* _ws_server = nullptr;
    bool _teleprompter_mode = false;
```

(The `class InputWebSocketServer*` forward reference avoids adding an include to the header.)

- [ ] **Step 2: Add includes and the menu toggle in `mainwindow.cpp`**

Near the other includes at the top of `mainwindow.cpp`, add:

```cpp
#include "inputwebsocketserver.h"
#include <QMenuBar>
#include <QMenu>
#include <QAction>
```

At the end of the `MainWindow` constructor body (after the `_thread->start(...)` line around line 159), add:

```cpp
    // Teleprompter streaming toggle
    QMenu* tpMenu = menuBar()->addMenu(tr("Teleprompter"));
    QAction* tpAction = tpMenu->addAction(tr("Streaming Mode"));
    tpAction->setCheckable(true);
    connect(tpAction, &QAction::toggled,
            this, &MainWindow::onTeleprompterModeToggled);
```

- [ ] **Step 3: Implement the toggle slot in `mainwindow.cpp`**

Add this method (e.g. just after the `onNewInputData` definition):

```cpp
void MainWindow::onTeleprompterModeToggled(bool on)
{
    _teleprompter_mode = on;
    if (on) {
        if (!_ws_server) {
            _ws_server = new InputWebSocketServer(8420, this);
            connect(_worker, SIGNAL(newInputData(QList<int>,QList<double>)),
                    _ws_server, SLOT(onNewInputData(QList<int>,QList<double>)));
        }
        // ensure the worker is polling inputs while teleprompting
        emit enableInputStreaming(true);
    } else {
        if (_ws_server) {
            _ws_server->deleteLater();
            _ws_server = nullptr;
        }
    }
}
```

- [ ] **Step 4: Suppress OS mouse/keyboard while streaming**

At the very top of `MainWindow::onNewInputData(QList<int> button_data, QList<double> analog_data)` (around line 494), add:

```cpp
    if (_teleprompter_mode) {
        // Bridge is wired directly to the worker; skip OS keyboard/mouse output.
        return;
    }
```

- [ ] **Step 5: Build the app**

Run (from `QJoyControl/`):
```bash
qmake QJoyControl.pro && make
```
Expected: builds with no errors.

- [ ] **Step 6: Commit** _(SKIP — see source-control note)_

```bash
git add mainwindow.h mainwindow.cpp
git commit -m "feat: add teleprompter streaming toggle and input suppression"
```

---

## Task 5: Integration verification (manual, requires hardware)

- [ ] **Step 1: Run QJoyControl and connect the Left JoyCon**

Launch QJoyControl (Qt Creator Run, or the built binary). Pair/connect the Left JoyCon as per the README, select it, and Connect.

- [ ] **Step 2: Enable streaming mode**

In the menu bar, open **Teleprompter → Streaming Mode** and check it. Confirm the app no longer moves the mouse cursor when you move the stick (OS emulation suppressed).

- [ ] **Step 3: Verify frames reach the browser**

Serve the teleprompter web app (`npm run dev` in `teleprompter/`, from its own plan) and open `http://localhost:5173` (WebSocket source, the default). Confirm:
- The HUD shows **Controller ●** (connected).
- Pushing the stick up scrolls forward; down reverses; centering holds.
- Clicking the stick starts/stops cruise.
- D-pad up/down changes text size; left/right seeks by paragraph; SL/SR change max speed.

- [ ] **Step 4: Verify toggle-off restores normal behavior**

Uncheck **Teleprompter → Streaming Mode**. Confirm the JoyCon controls the mouse/keyboard again (normal QJoyControl behavior) and the browser HUD returns to **Disconnected** after the socket closes.

---

## Done criteria

- `tests/tst_serialize` passes.
- `qmake && make` builds the app with `QT += websockets` and the new files.
- With a real Left JoyCon in streaming mode, the browser teleprompter receives frames and the full control set works; toggling off restores normal QJoyControl mouse/keyboard behavior.
