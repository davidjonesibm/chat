# Chat App (iOS) — Conversion Phases

> Reference document for AI-assisted development sessions. Paste this into a new chat to resume work.

---

## Tech Stack

| Concern            | Decision                                       |
| ------------------ | ---------------------------------------------- |
| UI Framework       | SwiftUI (iOS 17+)                              |
| State Management   | `@Observable` macro + `@MainActor`             |
| Concurrency        | Swift async/await, actor-based                 |
| HTTP Client        | `URLSession` (custom `APIClient`)              |
| Auth               | Supabase Swift SDK                             |
| Real-time          | Native `URLSessionWebSocketTask` + async/await |
| Push Notifications | Azure Notification Hub (not direct APNs)       |
| GIFs               | Official GIPHY iOS SDK (SPM)                   |
| Package Manager    | Swift Package Manager                          |

---

## Backend API

- **Base URL**: `https://chat-kvwp.onrender.com`
- **WebSocket URL**: `wss://chat-kvwp.onrender.com/ws?token=JWT`
- **Auth**: Bearer token (Supabase JWT) in `Authorization: Bearer <token>` header
- **Supabase Project**: `https://cdwnjbzftwkrsoxoddqi.supabase.co`
- **GIPHY API Key**: `rBNut5aYm9PvYaKt15HrAV981xi6JpGn`

---

## Phase 1: Foundation ✅ COMPLETED

**Goal**: Auth flow, API client, root navigation.

### Key Files

| File                   | Purpose                                                                                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Config.swift`         | Central constants: `apiBaseURL`, `wsURL`, `supabaseURL`, `supabaseAnonKey`, `giphyAPIKey`                                                                    |
| `APIClient.swift`      | `URLSession` HTTP client — Bearer token injection, GET/POST/PATCH/DELETE, multipart upload                                                                   |
| `AuthService.swift`    | Supabase Swift SDK wrapper: `signUp`, `signIn`, `signOut`, `restoreSession`, `authStateChanges`                                                              |
| `AuthStore.swift`      | `@Observable @MainActor` — user/token state, `initAuth`, `register`, `login`, `logout`, `updateProfile`, `uploadAvatar`, `deleteAvatar`, `startAuthListener` |
| `Models/User.swift`    | `User` model + auth request/response models (`UpdateProfileRequest`, `UpdateProfileResponse`, `AvatarUploadResponse`)                                        |
| `chat_app_djApp.swift` | App entry point — injects `AuthStore`, routes to login vs chat                                                                                               |
| `ContentView.swift`    | Root routing view                                                                                                                                            |

### API Endpoints Used

- `POST /auth/register`
- `POST /auth/login`
- `GET /users/me`
- `PATCH /users/me`
- `POST /users/me/avatar` (multipart)
- `DELETE /users/me/avatar`

---

## Phase 2: Channel & Group List

**Goal**: Browse groups the user belongs to, view channels inside a group, create groups/channels.

### Key Files to Create/Modify

| File                             | Purpose                                                                     |
| -------------------------------- | --------------------------------------------------------------------------- |
| `Models/Group.swift`             | `GroupRecord` model matching backend API shape                              |
| `Models/Channel.swift`           | `ChannelRecord` model matching backend API shape                            |
| `Stores/GroupStore.swift`        | `@Observable @MainActor` — groups array, `fetchGroups`, `createGroup`       |
| `Stores/ChannelStore.swift`      | `@Observable @MainActor` — channels array, `fetchChannels`, `createChannel` |
| `Views/GroupListView.swift`      | List of groups the user belongs to                                          |
| `Views/ChannelListView.swift`    | Channels inside a selected group                                            |
| `Views/CreateGroupSheet.swift`   | Sheet for creating a new group                                              |
| `Views/CreateChannelSheet.swift` | Sheet for creating a new channel                                            |
| `Navigation/AppNavigation.swift` | Navigation stack: `GroupListView` → `ChannelListView` → `ChatView`          |

### API Endpoints Used

- `GET /groups` — user's groups
- `POST /groups` — create group
- `GET /groups/:id/channels` — channels in a group
- `POST /channels` — create channel
- `GET /groups/:id/members` — member count/list

---

## Phase 3: Real-time WebSocket + Messaging Foundation

**Goal**: Live messaging via WebSocket, message history, basic chat UI.

### Key Files to Create/Modify

| File                              | Purpose                                                                                           |
| --------------------------------- | ------------------------------------------------------------------------------------------------- |
| `Services/WebSocketService.swift` | `URLSessionWebSocketTask` actor — connect, disconnect, async receive loop, reconnect logic        |
| `Models/Message.swift`            | `MessageRecord` / `MessageWithSender` shape (matching backend response)                           |
| `Models/Events.swift`             | `ClientMessage` / `ServerMessage` discriminated union types (matching `libs/shared` `type` field) |
| `Stores/ChatStore.swift`          | `@Observable @MainActor` — messages array, send/receive, typing indicators, presence              |
| `Views/ChatView.swift`            | Basic chat shell — message list + text input                                                      |

### WebSocket Details

- Connect: `wss://chat-kvwp.onrender.com/ws?token=JWT`
- Use `URLSessionWebSocketTask` with `async`/`await` receive loop (ref: Donny Wals article)
- Reconnect on disconnect with exponential back-off
- Message types mirror shared discriminated union — always include `type` field

### API Endpoints Used

- `GET /channels/:id/messages` — paginated message history (`?page=1&limit=50`)
- `POST /channels/:id/messages` — send text message

### WebSocket Message Types (subset)

```swift
// Outgoing (ClientMessage)
{ "type": "join_channel", "channelId": "..." }
{ "type": "leave_channel", "channelId": "..." }
{ "type": "typing_start", "channelId": "..." }
{ "type": "typing_stop", "channelId": "..." }

// Incoming (ServerMessage)
{ "type": "new_message", "message": { ...MessageWithSender } }
{ "type": "typing", "userId": "...", "channelId": "...", "isTyping": true }
{ "type": "presence", "userId": "...", "status": "online" }
```

---

## Phase 4: Message UI

**Goal**: Polished message list and input bar with full UX.

### Key Files to Create/Modify

| File                                   | Purpose                                                              |
| -------------------------------------- | -------------------------------------------------------------------- |
| `Views/Chat/MessageBubble.swift`       | Own vs other styling, timestamps, avatar                             |
| `Views/Chat/MessageList.swift`         | Scroll-to-bottom, pagination on scroll-up, date separators           |
| `Views/Chat/MessageInputBar.swift`     | Multiline text field, send button, attachment icon placeholder       |
| `Views/Chat/TypingIndicatorView.swift` | Animated typing dots                                                 |
| `Views/Chat/MessageRouter.swift`       | Routes to correct sub-view per message `type` (text / image / giphy) |

### Message Types to Handle

| `type`  | View                         |
| ------- | ---------------------------- |
| `text`  | `TextMessageView`            |
| `image` | `ImageMessageView` (Phase 6) |
| `giphy` | `GiphyMessageView` (Phase 5) |

### UX Details

- Optimistic send: append message locally with `.sending` status, confirm on WS `new_message` echo
- Pagination: trigger `fetchMessages(page: n+1)` when scrolled to top
- Date separators: group messages by day

---

## Phase 5: GIPHY Integration

**Goal**: Send and receive GIF messages; emoji picker.

### Key Files to Create/Modify

| File                                | Purpose                                               |
| ----------------------------------- | ----------------------------------------------------- |
| `Views/Chat/GiphyPickerView.swift`  | Sheet presenting GIPHY SDK `GPHMediaView` grid picker |
| `Views/Chat/GiphyMessageView.swift` | Renders `GPHMediaView` for received giphy messages    |
| `Views/Chat/EmojiPicker.swift`      | Native emoji keyboard trigger or custom emoji grid    |

### GIPHY SDK Setup

- Package: Official GIPHY iOS SDK via SPM (already added to project)
- API Key: `rBNut5aYm9PvYaKt15HrAV981xi6JpGn`
- Initialize in `chat_app_djApp.swift`: `Giphy.configure(apiKey: Config.giphyAPIKey)`

### API Endpoints Used

- `POST /channels/:id/messages` with body `{ "type": "giphy", "gif_url": "https://..." }`

---

## Phase 6: Camera, Images & Profile

**Goal**: Image messages, camera capture, and full profile/avatar management.

### Key Files to Create/Modify

| File                                  | Purpose                                                                        |
| ------------------------------------- | ------------------------------------------------------------------------------ |
| `Utilities/ImagePicker.swift`         | `PHPickerViewController` (PhotosUI) + `UIImagePickerController` camera wrapper |
| `Views/Chat/ImageMessageView.swift`   | Async remote image with loading state + tap-to-expand                          |
| `Views/Profile/ProfileView.swift`     | Display/edit username, name, avatar                                            |
| `Views/Profile/AvatarImageView.swift` | Reusable avatar with fallback initials                                         |
| `Views/Group/GroupSettingsView.swift` | Rename group, manage members (add/remove), leave group                         |

### API Endpoints Used

- `POST /channels/:id/messages` multipart — image upload (type `"image"`)
- `PATCH /users/me` — update profile fields
- `POST /users/me/avatar` multipart — upload avatar
- `DELETE /users/me/avatar` — remove avatar
- `GET /groups/:id/members` — member list
- `POST /groups/:id/members` — add member
- `DELETE /groups/:id/members/:userId` — remove member
- `DELETE /groups/:id/members/me` — leave group

---

## Phase 7: Push Notifications (Azure Notification Hub)

**Goal**: Receive push notifications and deep-link to the correct channel.

### Key Files to Create/Modify

| File                                     | Purpose                                                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------------------------- |
| `Services/PushNotificationService.swift` | APNs permission request, device token registration, Azure NH REST integration               |
| `Services/NotificationHandler.swift`     | Handle incoming payloads, deep-link to channel, badge count management                      |
| `chat_app_djApp.swift`                   | Wire up `UNUserNotificationCenterDelegate`, call `registerForRemoteNotifications` on launch |

### Flow

1. On launch: request `UNUserNotificationCenter` authorization
2. On token received (`didRegisterForRemoteNotificationsWithDeviceToken`): POST to backend
3. Backend (`POST /push/register`) forwards to Azure Notification Hub
4. On notification tap: parse `channelId` from payload, navigate to `ChatView`

### API Endpoints Used

- `POST /push/register` — `{ "token": "...", "platform": "apns" }`
- `DELETE /push/unregister` — on sign-out

### Azure Notification Hub

- Do **not** integrate directly with APNs
- Use Azure NH SDK (SPM) **or** the Azure NH REST API from backend
- Backend already has `routes/push.ts` — verify registration/send payloads match

### Payload Shape (expected)

```json
{
  "aps": {
    "alert": { "title": "Group Name", "body": "Username: message text" },
    "badge": 1
  },
  "channelId": "...",
  "groupId": "..."
}
```

---

## Architecture Notes

- **No `!` non-null assertions** — use `if let`, `guard let`, `?? defaultValue`
- **All UI updates on `@MainActor`** — stores are `@Observable @MainActor`
- **`APIClient` is a plain struct/actor** — injected via environment or passed directly
- **`WebSocketService` is an actor** — prevents data races on socket state
- **Supabase SDK** is used **only** for auth (session management, token refresh) — all app data goes through Fastify
- **`Config.swift`** is the single source of truth for all URLs and API keys
