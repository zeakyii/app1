const STORAGE_KEY = "nebula-social-state-v1";
const channel = "BroadcastChannel" in window ? new BroadcastChannel("nebula-social-mesh") : null;

const starterMessages = [
  {
    id: crypto.randomUUID(),
    roomId: "family",
    authorId: "system",
    authorName: "Nebula",
    text: "Welcome. This room is private to this browser until you invite a peer, export a sync package, or open another tab.",
    createdAt: Date.now() - 180000,
    flagged: false
  },
  {
    id: crypto.randomUUID(),
    roomId: "family",
    authorId: "system",
    authorName: "Safety Guide",
    text: "Kid mode keeps public discovery off and checks every message before it is sent.",
    createdAt: Date.now() - 90000,
    flagged: false
  }
];

const defaultState = {
  profile: {
    id: crypto.randomUUID(),
    name: "Soumendra",
    ageMode: "family"
  },
  activeRoomId: "family",
  pausedRooms: [],
  rooms: [
    { id: "family", name: "Family Circle", invite: "NEB-FAMILY-" + shortId() },
    { id: "study", name: "Study Group", invite: "NEB-STUDY-" + shortId() }
  ],
  contacts: [
    { id: "guardian", name: "Guardian", role: "Trusted adult" },
    { id: "friend", name: "Best Friend", role: "Approved contact" }
  ],
  messages: starterMessages
};

let state = loadState();
let pendingModalAction = null;

const els = {
  displayName: document.querySelector("#displayName"),
  ageMode: document.querySelector("#ageMode"),
  safetyStrip: document.querySelector("#safetyStrip"),
  roomList: document.querySelector("#roomList"),
  contactList: document.querySelector("#contactList"),
  activeRoomName: document.querySelector("#activeRoomName"),
  roomStatus: document.querySelector("#roomStatus"),
  conversation: document.querySelector("#conversation"),
  composer: document.querySelector("#composer"),
  messageInput: document.querySelector("#messageInput"),
  messageCount: document.querySelector("#messageCount"),
  contactCount: document.querySelector("#contactCount"),
  peerStatus: document.querySelector("#peerStatus"),
  noticeBox: document.querySelector("#noticeBox"),
  modal: document.querySelector("#modal"),
  modalTitle: document.querySelector("#modalTitle"),
  modalBody: document.querySelector("#modalBody"),
  modalConfirm: document.querySelector("#modalConfirm"),
  importInput: document.querySelector("#importInput")
};

const safetyCopy = {
  kid: "Kid mode: trusted contacts only, stricter language checks, guardian review prompts.",
  teen: "Teen mode: private rooms, gentle language checks, block and report tools visible.",
  adult: "Adult mode: full controls with local moderation and private room invites.",
  family: "Family mode: shared safety defaults for mixed-age rooms."
};

function shortId() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return structuredClone(defaultState);
  try {
    return { ...structuredClone(defaultState), ...JSON.parse(raw) };
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function activeRoom() {
  return state.rooms.find(room => room.id === state.activeRoomId) || state.rooms[0];
}

function activeMessages() {
  return state.messages
    .filter(message => message.roomId === state.activeRoomId)
    .sort((a, b) => a.createdAt - b.createdAt);
}

function render() {
  const room = activeRoom();
  els.displayName.value = state.profile.name;
  els.ageMode.value = state.profile.ageMode;
  els.safetyStrip.textContent = safetyCopy[state.profile.ageMode];
  els.activeRoomName.textContent = room.name;
  els.roomStatus.textContent = state.pausedRooms.includes(room.id) ? "Room paused" : "Local-first room";
  els.messageCount.textContent = activeMessages().length;
  els.contactCount.textContent = state.contacts.length;
  els.noticeBox.textContent = moderationNotice();
  renderRooms();
  renderContacts();
  renderMessages();
  saveState();
}

function renderRooms() {
  els.roomList.replaceChildren(...state.rooms.map(room => {
    const button = document.createElement("button");
    button.className = "room-item" + (room.id === state.activeRoomId ? " active" : "");
    button.type = "button";
    button.textContent = room.name;
    button.addEventListener("click", () => {
      state.activeRoomId = room.id;
      render();
    });
    return button;
  }));
}

function renderContacts() {
  els.contactList.replaceChildren(...state.contacts.map(contact => {
    const item = document.createElement("button");
    item.className = "contact-item";
    item.type = "button";
    item.textContent = `${contact.name} - ${contact.role}`;
    item.addEventListener("click", () => showContact(contact));
    return item;
  }));
}

function renderMessages() {
  const nodes = activeMessages().map(message => {
    const card = document.createElement("article");
    card.className = "message";
    if (message.authorId === state.profile.id) card.classList.add("mine");
    if (message.flagged) card.classList.add("flagged");

    const meta = document.createElement("div");
    meta.className = "message-meta";
    meta.innerHTML = `<strong></strong><time></time>`;
    meta.querySelector("strong").textContent = message.authorName;
    meta.querySelector("time").textContent = new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    const text = document.createElement("p");
    text.textContent = message.flagged ? "Message hidden by local safety settings." : message.text;

    const actions = document.createElement("div");
    actions.className = "message-actions";
    const flag = document.createElement("button");
    flag.type = "button";
    flag.textContent = message.flagged ? "Unflag" : "Flag";
    flag.addEventListener("click", () => {
      message.flagged = !message.flagged;
      render();
    });
    const block = document.createElement("button");
    block.type = "button";
    block.textContent = "Block";
    block.addEventListener("click", () => blockAuthor(message.authorId, message.authorName));
    actions.append(flag, block);

    card.append(meta, text, actions);
    return card;
  });

  els.conversation.replaceChildren(...nodes);
  els.conversation.scrollTop = els.conversation.scrollHeight;
}

function moderationNotice() {
  const flagged = activeMessages().filter(message => message.flagged).length;
  const roomPaused = state.pausedRooms.includes(state.activeRoomId);
  if (roomPaused) return "Sending is paused in this room. Review recent messages before reopening.";
  if (flagged) return `${flagged} message${flagged === 1 ? "" : "s"} hidden in this room. Flags stay local unless you export them.`;
  return "No safety flags in this room. Contacts and rooms are stored locally on this device.";
}

function isRiskyText(text) {
  const riskyWords = ["hate", "kill", "stupid", "idiot", "address", "phone number"];
  const lower = text.toLowerCase();
  return riskyWords.some(word => lower.includes(word));
}

function sendMessage(text, external = false) {
  const room = activeRoom();
  if (state.pausedRooms.includes(room.id)) {
    toast("Room is paused. Reopen it before sending.");
    return;
  }

  const flagged = ["kid", "teen", "family"].includes(state.profile.ageMode) && isRiskyText(text);
  const message = {
    id: crypto.randomUUID(),
    roomId: room.id,
    authorId: state.profile.id,
    authorName: state.profile.name || "Anonymous",
    text,
    createdAt: Date.now(),
    flagged
  };

  state.messages.push(message);
  render();

  if (!external && channel) {
    channel.postMessage({ type: "message", message, invite: room.invite });
    els.peerStatus.textContent = "Message offered to local browser peers.";
  }
}

function toast(text) {
  els.noticeBox.textContent = text;
}

function openModal(title, bodyNode, confirmText, onConfirm) {
  pendingModalAction = onConfirm;
  els.modalTitle.textContent = title;
  els.modalBody.replaceChildren(bodyNode);
  els.modalConfirm.textContent = confirmText;
  els.modal.showModal();
}

function makeStack(fields) {
  const stack = document.createElement("div");
  stack.className = "modal-stack";
  fields.forEach(field => stack.append(field));
  return stack;
}

function makeField(labelText, input) {
  const label = document.createElement("label");
  label.className = "field";
  const span = document.createElement("span");
  span.textContent = labelText;
  label.append(span, input);
  return label;
}

function showNewRoom() {
  const name = document.createElement("input");
  name.maxLength = 32;
  name.placeholder = "Room name";
  openModal("Create Private Room", makeStack([makeField("Name", name)]), "Create", () => {
    const roomName = name.value.trim();
    if (!roomName) return;
    const id = crypto.randomUUID();
    state.rooms.push({ id, name: roomName, invite: "NEB-" + shortId() + "-" + shortId() });
    state.activeRoomId = id;
    render();
  });
}

function showAddContact() {
  const name = document.createElement("input");
  const role = document.createElement("input");
  name.maxLength = 28;
  role.maxLength = 32;
  name.placeholder = "Name";
  role.placeholder = "Role";
  openModal("Add Trusted Contact", makeStack([makeField("Name", name), makeField("Role", role)]), "Add", () => {
    const contactName = name.value.trim();
    if (!contactName) return;
    state.contacts.push({ id: crypto.randomUUID(), name: contactName, role: role.value.trim() || "Trusted contact" });
    render();
  });
}

function showContact(contact) {
  const body = document.createElement("div");
  body.className = "modal-stack";
  const text = document.createElement("p");
  text.textContent = `${contact.name} is marked as ${contact.role}. In a production build this contact would have a verified public key.`;
  body.append(text);
  openModal("Contact", body, "Done", () => {});
}

function copyInvite() {
  const room = activeRoom();
  navigator.clipboard?.writeText(room.invite);
  toast(`Invite code for ${room.name}: ${room.invite}`);
}

function exportState() {
  const packageData = {
    exportedAt: new Date().toISOString(),
    profileHint: state.profile.name,
    rooms: state.rooms,
    contacts: state.contacts,
    messages: state.messages
  };
  const blob = new Blob([JSON.stringify(packageData, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `nebula-sync-${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

async function importState(file) {
  const text = await file.text();
  const incoming = JSON.parse(text);
  const knownIds = new Set(state.messages.map(message => message.id));
  state.rooms = mergeById(state.rooms, incoming.rooms || []);
  state.contacts = mergeById(state.contacts, incoming.contacts || []);
  state.messages.push(...(incoming.messages || []).filter(message => !knownIds.has(message.id)));
  render();
  toast("Imported sync package and merged new rooms, contacts, and messages.");
}

function mergeById(local, incoming) {
  const map = new Map(local.map(item => [item.id, item]));
  incoming.forEach(item => map.set(item.id, { ...map.get(item.id), ...item }));
  return [...map.values()];
}

function blockAuthor(authorId, authorName) {
  if (authorId === state.profile.id || authorId === "system") {
    toast("This author cannot be blocked in the prototype.");
    return;
  }
  state.messages.forEach(message => {
    if (message.authorId === authorId) message.flagged = true;
  });
  render();
  toast(`${authorName} is hidden locally in this room.`);
}

function guardianSettings() {
  const select = document.createElement("select");
  ["kid", "teen", "family", "adult"].forEach(mode => {
    const option = document.createElement("option");
    option.value = mode;
    option.textContent = mode[0].toUpperCase() + mode.slice(1);
    select.append(option);
  });
  select.value = state.profile.ageMode;
  openModal("Guardian Settings", makeStack([makeField("Default age mode", select)]), "Apply", () => {
    state.profile.ageMode = select.value;
    render();
  });
}

els.displayName.addEventListener("change", event => {
  state.profile.name = event.target.value.trim() || "Anonymous";
  render();
});

els.ageMode.addEventListener("change", event => {
  state.profile.ageMode = event.target.value;
  render();
});

els.composer.addEventListener("submit", event => {
  event.preventDefault();
  const text = els.messageInput.value.trim();
  if (!text) return;
  sendMessage(text);
  els.messageInput.value = "";
});

document.querySelector("#newRoomBtn").addEventListener("click", showNewRoom);
document.querySelector("#addContactBtn").addEventListener("click", showAddContact);
document.querySelector("#copyInviteBtn").addEventListener("click", copyInvite);
document.querySelector("#exportBtn").addEventListener("click", exportState);
document.querySelector("#guardianBtn").addEventListener("click", guardianSettings);

document.querySelector("#pauseRoomBtn").addEventListener("click", () => {
  const roomId = state.activeRoomId;
  if (state.pausedRooms.includes(roomId)) {
    state.pausedRooms = state.pausedRooms.filter(id => id !== roomId);
  } else {
    state.pausedRooms.push(roomId);
  }
  render();
});

document.querySelector("#clearFlagBtn").addEventListener("click", () => {
  state.messages.forEach(message => {
    if (message.roomId === state.activeRoomId) message.flagged = false;
  });
  render();
});

document.querySelector("#toneBtn").addEventListener("click", () => {
  els.messageInput.value = "I hear you. Can we talk about this kindly?";
  els.messageInput.focus();
});

els.importInput.addEventListener("change", event => {
  const [file] = event.target.files;
  if (!file) return;
  importState(file).catch(() => toast("That sync package could not be imported."));
  event.target.value = "";
});

els.modal.addEventListener("close", () => {
  if (els.modal.returnValue !== "cancel" && pendingModalAction) pendingModalAction();
  pendingModalAction = null;
});

if (channel) {
  channel.addEventListener("message", event => {
    const { type, message, invite } = event.data || {};
    const room = state.rooms.find(item => item.invite === invite);
    if (type !== "message" || !room || state.messages.some(item => item.id === message.id)) return;
    state.messages.push({ ...message, roomId: room.id });
    render();
    els.peerStatus.textContent = "Received a message from a local browser peer.";
  });
}

render();
