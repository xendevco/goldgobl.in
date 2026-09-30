# GoldGobl.in: WoW Midnight Season 2 Goldmaking Platform

## 1. Project Overview
We are a two-person team building **GoldGobl.in**, a specialised World of Warcraft goldmaking suite for the Midnight expansion (Season 2). The project consists of two linked components:
1.  **Static Web App (goldgobl.in):** Hosted on GitHub Pages, acting as the primary analytics dashboard, calculator, and roster manager.
2.  **WoW Lua Addon (GoldGoblin):** An in-game scanner that exports character details, racials, known recipes, and inventories via a compressed, copy-pasteable text string for web import.

**Core Goal:** Maximise gold generation through profession profitability, cross-realm arbitrage, housing decor crafting, optimal levelling, and automated alt army profession management. We must architect the platform to easily support premium subscription tiers in the future.

## 2. Technical Stack & Infrastructure
**Constraint Checklist for AI Agent:**
*   **Domain & DNS:** Domain registered via Namecheap, DNS managed by Cloudflare.
*   **Hosting:** GitHub Pages with the custom domain `goldgobl.in`. The repository must generate a `CNAME` file containing exactly `goldgobl.in` in the build output. The frontend MUST be entirely static. No Node.js backend, no Express servers, and no database infrastructure.
*   **Frontend Framework:** React (Vite or Next.js static export), TypeScript, Tailwind CSS.
*   **UI/UX:** shadcn/ui and Lucide icons. The design must be modern, highly functional, and data-dense. Use a sophisticated dark mode palette (slate/zinc neutrals with subtle thematic accents for the Midnight expansion).
*   **Data Proxy (api.goldgobl.in):** Because GitHub Pages cannot store secret API keys, all calls to the Blizzard Auction House API and TradeSkillMaster (TSM) API must be routed through a lightweight Cloudflare Worker hosted on `api.goldgobl.in`. The worker must be structured so we can easily add JWT authentication or rate limiting for future paid subscribers.
*   **Addon Sync:** The Lua addon will use the `SavedVariables` API to accumulate account-wide character data across all logins. It will render this data as a Base64 encoded JSON string in a scrollable frame for the user to copy and paste into the web app.

## 3. Core Modules to Develop

### Module A: The Data Pipeline & Addon
*   **Lua Addon:** 
    *   Tracks character names, classes, races (for racial crafting bonuses), and current skill levels.
    *   Scans known recipes, Midnight knowledge points, and current profession equipment.
    *   Accumulates data in `SavedVariables` across all character logins on the account.
    *   Outputs a single Base64 compressed payload string via a pop-up frame.
*   **Web Import:** A text parser that ingests the payload, validates the schema, and writes directly to browser `localStorage` and global client state (Zustand).

### Module B: Crafting Syndicate & Roster Optimiser
*   **Target Capacity Configuration:** A control permitting the user to set their target number of crafting characters (e.g. 4, 8, 12, or 20+ alts).
*   **Racial Synergy Matcher:** Recommends profession allocations based on racial crafting bonuses (e.g. Goblin Alchemy, Draenei Jewelcrafting, Gnome Engineering).
*   **Matrix Optimisation:** Calculates the optimal profession matrix to ensure 100% coverage of primary crafting disciplines and maximal stacking of daily cooldowns.
*   **Assignment View:** Displays a per-character assignment sheet with visual tags: "Keep", "Drop & Learn [X]", "Missing Key Recipe", or "Cooldown Ready".

### Module C: Profession Profitability Scanner
*   **Functionality:** Calculates real-time crafting costs vs. current Auction House market value.
*   **Data Sources:** Blizzard API (live commodity pricing) and TSM API (historical pricing and sales rates) via `api.goldgobl.in`.
*   **Yield Maths:** Must account for Midnight specific profession stats (Multicraft, Resourcefulness, Ingenuity) when calculating expected net return.

### Module D: Cross-Realm Arbitrage Engine
*   **Functionality:** Identifies server-to-server price discrepancies for non-stackable items.
*   **Focus Items:** BoE gear, battle pets, and crafted Midnight Housing Decor items transferred between realms via the Warbank.

### Module E: Midnight Decor Hub
*   **Functionality:** Dedicated dashboard tracking high-volume player housing decor items.
*   **Data Caching:** Hardcode static recipe data and material requirements in a local JSON schema, pulling live prices only for those specific reagents to minimise API overhead.

### Module F: Profession Levelling Optimiser
*   **Functionality:** Solves the cheapest mathematical route to level a profession from 1 to maximum skill.
*   **Mechanism:** Graph search algorithm that pulls live reagent prices and recalculates the lowest-cost path dynamically based on market shifts.

## 4. Development Phases (Cursor Instructions)
Agent, execute this project strictly in the following order. Do not proceed to a new phase until the current phase is fully verified.

*   **Phase 1: Project Setup & API Proxy.** Initialise the React/Vite/TypeScript repository with Tailwind CSS and shadcn/ui. Ensure the build script outputs a `CNAME` file for `goldgobl.in`. Create the Cloudflare Worker script (`worker.js`) to securely broker requests to Blizzard and TSM at `api.goldgobl.in`, stubbing out an auth check function for future subscription tiers.
*   **Phase 2: Lua Addon Development.** Write the WoW addon (`GoldGoblin.toc` and `GoldGoblin.lua`) to collect character data into an account-wide table, generating an encoded export string.
*   **Phase 3: State Management & Import Engine.** Implement the Base64 import modal, schema validation, and Zustand store with persistent `localStorage`.
*   **Phase 4: Roster & Syndicate Matrix.** Build Module B (target character selector, racial bonus matching, and coverage assignment algorithms).
*   **Phase 5: Profitability & Decor Modules.** Build the crafting profit calculators and the Midnight Housing Decor tracker.
*   **Phase 6: Arbitrage & Levelling Optimiser.** Implement the cross-realm Warbank arbitrage scanner and the dynamic levelling pathfinder.

## 5. Coding Standards
*   Use strict TypeScript types for all character models, recipe schemas, and API responses.
*   Ensure the UI is dense and analytical, prioritising sortable tables and clear data visualisations over empty spacing.
*   Gracefully handle Blizzard API rate limits with client-side caching.
*   Always use UK English spelling (e.g. optimiser, colour, prioritising).