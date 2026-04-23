# 🃏 Italy — 4-Player Team Card Game

A real-time multiplayer browser card game built with Node.js + Socket.IO.

---

## 🎮 Gameplay Overview

**Italy** is a 4-player team-based trick-taking card game.

| Team | Players |
|------|---------|
| Team A | Seat 1 + Seat 3 |
| Team B | Seat 2 + Seat 4 |

### Card Hierarchy
`Ace > King > Queen > Jack > 10 > 9 > 8 > 7 > 6 > 5 > 4 > 3 > 2`

---

## 🚀 Running Locally

```bash
# 1. Install dependencies
npm install

# 2. Start the server
npm start

# 3. Open your browser
http://localhost:3000
```

For development with auto-reload:
```bash
npm run dev
```

---

## ☁️ Deploy to Render.com (Free)

1. Push this project to a **GitHub repository**
2. Go to [render.com](https://render.com) and sign in
3. Click **"New +"** → **"Web Service"**
4. Connect your GitHub repo
5. Render will auto-detect settings from `render.yaml`:
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
6. Click **"Create Web Service"**
7. Your game will be live at `https://your-service.onrender.com`

> **Note:** On Render's free tier the server may spin down after inactivity. The first request after a spin-down takes ~30 seconds to wake up.

---

## 🧠 Game Rules

### Setup
- 52-card standard deck, 4 players
- First deal: **5 cards** each (one at a time)

### Calling Phase
Players call in order (starting from Seat 1):
- **7, 8, or 9** — how many tricks your team must win
- **Nil / Pass** — skip (Seat 4 must always call if nobody else has)

When a player bids, they secretly place one card face-down as the **Power Card** (trump indicator). If outbid, the card is returned and the new bidder picks their own power card.

### Dealing Remainder
After calling, each player receives **4 more cards at a time** until everyone holds **13 cards** (the bidder holds 12 + 1 face-down Power Card).

### Gameplay
- Seat 1 always leads Trick 1
- **You must follow the led suit** if you have it
- If you can't follow suit:
  - You may play a trump card (revealing it if not yet revealed)
  - Or discard any card
- **Exception:** If your teammate is already winning the trick and you have trump cards but no led suit, you may discard instead of trumping

### Trump Rules
- The Power Card's suit is the Trump Suit
- Playing a card of that suit (when you have no led suit) **reveals** the trump
- Once revealed, trump beats all non-trump cards
- A higher trump beats a lower trump (**overtrumping**)

### Scoring
| Result | Calling Team | Other Team |
|--------|-------------|------------|
| Success (tricks ≥ bid) | +bid | 0 |
| Failure (tricks < bid) | −bid | +(opponent tricks − 5) |

The game ends when one team reaches the **match target** (30 or 50 points).

---

## 🏗 Project Structure

```
italy-card-game/
├── server.js          # Node.js + Socket.IO game server & all game logic
├── public/
│   ├── index.html     # Game UI (all screens + overlays)
│   └── game.js        # Client-side socket handling, rendering, D&D
├── package.json
├── render.yaml        # Render.com deployment config
└── README.md
```

---

## 🛠 Tech Stack

| Layer | Tech |
|-------|------|
| Backend | Node.js + Express |
| Real-time | Socket.IO v4 |
| Frontend | Vanilla HTML/CSS/JS |
| Fonts | Google Fonts (Playfair Display + Crimson Text) |
| Audio | Web Audio API (synthesised tones, no files needed) |
| Deploy | Render.com |
