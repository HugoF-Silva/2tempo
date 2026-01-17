# WAZE DO SUS -> www.menostempo.com.br 
- recomendamos pra você o hospital + adequado dependendo do que precisa

# Como funciona?
Explique as suas necessidades, 
> tá com algum sintoma? precisa de algum remédio?

a menostempo acha um hospital próximo que **menos te gasta** ⌚ e **mais te atende** 🧑🏻‍⚕️.
> priorizamos os hospitais próximos e vazios (resditribuindo as filas)

# open source 🔓

# Install Backend Deps
1. cd backend
1. python3.12 -m venv .env
2. source .env\bin\activate
3. npm install

# Install Frontend Deps
1. cd health-waze
2. npm install

# Run it dev
1. cd 2tempo
2. docker-compose up --build


### Context
Health center units info for population a city (so they know where which is the one which will attend them better at their surroundings).

### You
You must consider the:
1. app paradigms,
2. the piece of code,
3. the rules and page flow
And provide the solution so it works properly.

Notice: It is a big codebase. If to provide a properly solution something tells you that is better to know about how a thing or other is implemented, ask, and I will provide.

### WebApp Paradigms and limitations
A PWA deployed in AWS and Vercel.

#### Core
1. **Server-Driven Flow (BFF/SDUI)** — the server decides what the user should see next (`shows`, `pages_after`, CTAs), the client just maps IDs to components.
    
2. **CTA Entitlement Tokens (per action, short-TTL)** — any “earn/spend T$” or “unlock” action needs a server-issued token; the server re-checks before granting. Keeps rules secret and prevents gaming.
    
3. **Route-driven SPA** — keep the site fast and simple: the router controls URLs; the _content of pages and which buttons are enabled_ comes from the server. 
    
4. **Assignment Inbox (optional, later)** — for pushy gamified flows (quests/referrals). Start with pull (cheap), add push later if needed.

> We **don’t** put rules in the frontend. We **don’t** ship thresholds or reasons. The client receives opaque IDs + i18n keys + entitlements.

- **First-visit excellence**: `/bootstrap` gives tutorial flags and starting T$ without extra hops. 
- **No account required**: anonymous sessions supported; _risk of loss_ is just a server-side expiry on anon balances.
- **Community first**: help pages are available only when the server deems them meaningful and honest (radius/time rules).

**Frontend (Vercel):**
- Static assets CDN-cached. PWA enabled.

**Backend (AWS):**
- **API Gateway (HTTP API) + Lambda** (Python) for the endpoints.
- **DynamoDB** for users, sessions (or Cognito), T$ ledger, entitlements, centre snapshots, counters.
- **EventBridge scheduled rules** at `*/30 * * * *` to run a **validation Lambda** that settles 75%.
- **On-demand DynamoDB TTL** for expiring entitlements and unlock windows.
- API Gateway **WebSocket** for live centre updates.

#### Page-by-page paradigm mapping

|Page / Flow|Rendering paradigm|Who decides state?|How actions are allowed|
|---|---|---|---|
|**Home**|Route-driven|Server via **/bootstrap** (first visit/tutorial flags, first-access bonuses)|None (display-only)|
|**Map**|Route-driven + **Server-Driven Flow** for what to highlight, which pins are “locked/unlocked”, CTAs|Server via **/flow/map** (given user geolocation)|“Discover” shows only when server returns entitlement for that pin|
|**X: readStatusPage** (unlocked, not radius1)|Route-driven template; **server drives content availability**|Server via **/centre/:id/read**|Read-only; “Discover”/“Spend” requires token|
|**Y: readWriteStatusPage** (in radius1)|Route-driven template; **server enables write widgets**|Server via **/centre/:id/write-eligibility**|Each “help …” button requires **cta_token** (per page & hour)|
|**W: Help pages** (earn by info)|Route-driven carousel; **server decides which steps are enabled**|Server via **/help/plan**|Each Send/Confirm/Deny requires **cta_token**; server validates and later settles the 75%|
|**Z: helpByGrowingCommunity**|Route-driven; referral link + counters from server|Server|Referral credit claim via **cta_token** on completion callback|
|**Account pages**|Route-driven; CSR|Server for session & prompts (e.g., idle→sign-in nudge)|Auth endpoints only| 
|**Prompts/Overlays/“help as I was helped”**|**Server-Driven Flow** (client reports dwell events)|Server via **/flow/nudges**|Server replies with CTA IDs; client only renders|


#### Minimal API surface

**Identity:** use HttpOnly session cookie for signed-in; mint an **anonymous session cookie** for guests.

1. `POST /bootstrap` → `{ schema, first_access, tutorial_steps, hud:{balance,score}, shows:"home|map" }`
    - Called on first load. 
2. `POST /flow/map` → server receives `{ location, symptoms?, session }` and returns:
    `{   "schema":"1",   "pins":[{"id":"c123","locked":true},{"id":"c456","locked":false}],   "highlights":["c456"],                 // based on symptoms   "overlays":[{"id":"cta.low_balance","copy_key":"cta.use_ts"}],   "pages_after": null                    // or "X" / "Y" / "W" / "Z" }`
3. `POST /centre/:id/open` → decides **X vs Y** and returns entitlements for allowed actions on that page.
    - Example Y (radius1):
        `{ "shows":"Y", "entitlements":[    {"cta":"help.fullness","token":"...","limit":"1/h"},    {"cta":"help.treatment_available","token":"...","limit":"1/day"},    {"cta":"help.doctors_confirm_deny","token":"...","limit":"2/h"} ]}`
4. `POST /cta/execute` → `{ cta_id, token, payload }` → spends/earns, returns `{ result, balance, validation_due_at? }`.
    - All earnings in radius1 except “treatment available” pay **25% now / 75% on validation** (server schedules validation).
5. `POST /flow/nudges` → `{ page, dwell_sec, recent_actions[] }` → returns CTA IDs to show (e.g., “help as I was helped”).
6. (Optional, later) `GET /assignments` (precomputed quests) and WS/SSE stream.
> **No reasons, no thresholds** in responses. Only opaque IDs, i18n keys, amounts, and tokens.

#### Time windows & rules (all on server)
- **Radius math** (50 m / 7 km / 13 km) → computed server-side from client-sent GPS.
- **Unlock display windows:** 2 weeks/1.5 weeks; **radius1 display** until next clock hour.
- **Rate limits:** “per hour/per day” counters keyed by (user, centre, action).
- **36 h radius1 memory:** permits limited off-site help.
- **Validation rounds:** every **:00 and :30** — settle remaining 75% if statistically confirmed.
- **Community growth caps:** 2 signups/month; link rotates monthly.

#### Data & Tokens (enforcement with secrecy)
**T$ ledger**: append-only rows `{user, delta, reason, centre?, action?, ts}`

**Entitlement/CTA token** (JWS): `{ sub, cta, centre_id, aud:"web", ver, exp, nonce }`
- Issued by `/centre/:id/open` and `/help/plan`, **short TTL** (e.g., 5–10 min), per session.
- `/cta/execute` verifies token **and** re-checks limits (hourly/daily caps) before crediting.
- Rewards: immediate 25% now; remaining 75% queued for the next validation tick.

**Unlocks**: persisted as `{user, centre_id, scope: "radius1"|"radius2", expires_at}`; server decides visibility windows.

#### Minimal rule engine shape
**BFF Lambda** exports handlers and calls a local `rules.ts`: pure functions for:
- `decideMapView(state, gps, symptoms)`
- `openCentre(state, centre_id, gps)` → `shows + entitlements`
- `permitCta(state, cta, centre_id)` → issue/deny token
- `executeCta(state, cta, payload)` → mutate ledger atomically
- `nudges(state, page, dwell)` → list of CTA ids to show

#### Bottom line
- **Primary paradigm:** **Server-Driven Flow** for “what to show” + **CTA Tokens** for “what the user may do,” with a **route-driven** UI shell.
- **Everything rule-ish lives in Lambda**, never in the client.

#### Core mechanics
All possible actions in this gamified website revolve around the user’s geolocation.
There are three main geolocation concepts in the website:
- **Radius1:** each center has a radius of 50 meters that strictly covers the center itself. If the user’s location is within this radius, it means the user is physically at the center.
- **Radius2:** each center also has a radius of 7 km. If the user is not inside radius 1 but is inside radius 2, the system considers the user as being within radius 2 of the center.
- **Radius3:** the user has a personal radius of 13 km. There may be multiple centers located within this range.

Being inside radius1 or radius2, or having a specific number of centers within radius 3, are the main determinants for:
- Which user actions are allowed,
- Which messages are shown to the user,
- Which calls to action are triggered,
- Which **pages_after** (pages shown after the two main ones: homepage and map page) become available in the UI.

#### Triggering states
**“I can’t do (1) — i.e., tap +info on an unlocked center — if it’s not unlocked. How do I unlock it?”**
- You must tap a locked center (gray pinpoint) and then tap _discover_.

---

**“When is a user prompted to tap _discover_ on a center?”**
- When they voluntarily tap the pinpoint of a locked center.
- When they don’t have enough T$, and the system triggers a call to action to make them aware of it. Trying to _discover_ without having T$ triggers outcome (4), which can lead to (4.1) or (4.2) — i.e., how to earn T$ by helping with information **or** by helping with community growth.
- When it’s the user’s very first time using the app, they are within radius 1 or 2 of at least one center, and they’ve already gone through the intuitive tutorial that shows how to pop up details about a center.

---

**“What are the possible situations when a user first opens the website?”**  
a) They open it while physically within radius 1 of a center.  
b) They open it while not in radius 1, but within radius 2 of a center.  
c) They open it while outside radius 1 and radius 2 of all centers.  
d) Any of the above (a, b, c), but through a community growth link.  
e) Any of the above (a, b, c), but through the normal website link.

---

**“I can’t do (2) — i.e., tap +info on an unlocked center where radius 1 includes my location — if it’s not unlocked. How do I unlock it?”**
- You don’t need to. Simply being inside radius 1 immediately unlocks the center.

---

**“Why must the user be in radius 1 or 2 the first time they use the app?”**
- Because the intuitive tutorial relies on radius-based mechanics.

---

**“What if the user’s first access is within radius 3?”**
- Regardless of whether it’s their first time, the system prioritizes mechanics in this order: radius 1 → radius 2 → radius 3.
- However, radius 3 mechanics are not yet implemented. So if the user is too far, the website simply informs: _“The service hasn’t grown enough to reach your region.”_

---

**“What are the possible circumstances for guiding the user through radius 2 mechanics?”**
- The user is accessing the website for the first time from within radius 2.
- The user is accessing from radius 2, and the last radius 1 they visited was less than 36 hours ago.

---

**“Why does it matter if their last radius 1 visit was less than 36 hours ago?”**
- Because if a call to action occurs while the user doesn’t have enough T$, and they haven’t yet completed _last_radius1.help_with_available_treatment_ or _last_radius1.help_with_available_doctor_, then they can still earn T$ by completing whichever of the two is missing — as long as it’s within 36 hours.

---

**“When does a user not have enough T$?”**
- When they’ve spent enough that they can’t afford to unlock any information from any center.

---

**“When does the system execute a call to action to make the user notice they don’t have enough T$?”**
- When they don’t have enough T$ **and** can earn more by providing information.
- When their last info purchase happened within two weeks of first access, and:
    - they don’t have enough T$,
    - haven’t been in a radius 1 for the past 36 hours,
    - and it’s been more than two weeks since the last info purchase.
- When their last info purchase happened after two weeks of first access, and:
    - they don’t have enough T$,
    - haven’t been in a radius 1 for the past 36 hours,
    - and it’s been more than 1.5 weeks since the last info purchase.

---

**“When can a user _not_ earn T$ by providing information?”**
- When they’ve already provided all the information they could, given their current circumstances.

---

**“What information can the user provide depending on their circumstances?”**
- **If inside radius 1 of a center:**
    - `centre.help_with_available_treatment`
    - `centre.help_with_fullness_info`
    - `centre.help_by_confirming_or_denying_doctor_availability`
    - `centre.help_with_current_doctors_on_call_info`
    - `centre.help_by_confirming_or_denying_drug_availability`
    - `centre.help_with_informing_new_drug_available`
    
- **If not in radius 1 but visited a radius 1 within the last 36 hours:**
    - `centre.help_with_available_treatment`
    - `centre.help_by_confirming_or_denying_doctor_availability`

---

**“If the user has already provided all possible information, how else can they earn T$?”**
- If the last info purchase was **less than 2 weeks ago:** they must physically visit a radius 1 and help there to earn more T$.
- If the last info purchase was **within the first 2 weeks of access** and it’s been **more than 2 weeks** since then, the system triggers a call to action. If the user accepts (“earn more”), they are taken to the **earn by helping community grow** page, where they get a unique referral link. If someone creates an account through that link, they earn T$ (up to 2 people).
- If the last info purchase was **after 2 weeks of access** and it’s been **more than 1.5 weeks** since then, the same system triggers and leads to the **earn by helping community grow** page, with the same referral link limit of 2.

---

**“Is there any other moment when the user is called to action?”**
- Yes. After loading the markdown on the _availableTreatments_ page, if screen time without typing in the text box reaches **10 seconds**, the system prompts the user to _“help as you were helped.”_

### User state
The **user state** includes information such as radius data but also many other variables:
- Whether the user is within **radius 1** of a center.
- Whether the user is within **radius 2** of a center (note: for the system, being in radius 1 ≠ being in radius 2 — it’s one or the other, never both).
- The number of centers within the user’s **radius 3**.
- The **T$ balance** (regardless of location).
- Time since the user purchased access to information (regardless of location).
- Time since the last radius 1 visit, and whether the user already helped with available services at that center (now in radius 2).
- Time since the last radius 1 visit, and whether the user already helped with available doctors at that center (now in radius 2).
- Time remaining for the **universal checkpoint** validating user-provided information (when in radius 1).
- Accumulated screen time without typing in the textbox after the markdown loaded on the **availableTreatments** page (regardless of location).
- Whether the user is logged in (regardless of location).
- Accumulated screen time without spending T$ since last helping (either via community growth or by providing information).
- How many people have used the user’s community growth link to create an account.
- Whether this is the user’s **first time** accessing the website.
- Number of **help with confirm_or_deny_drug** actions in the current hour (radius 1).
- Number of **help with new drug available** actions in the current hour (radius 1).
- Whether the user has provided **help with fullness info** in the current hour (radius 1).
- Whether the user has already provided **help with available services** in the current day (radius 1).

#### Main 6 outcomes
The 6 main outcomes are:
1. **Tapping an unlocked center (not in radius 1):**  
    When you tap on the pinpoint of an _unlocked_ center and then tap for more info, if you are **not** within its radius 1, the _pages_after_ will be **X**.
    
2. **Tapping an unlocked center (in radius 1):**  
    When you tap on the pinpoint of an _unlocked_ center and then tap for more info, if you **are** within its radius 1, the _pages_after_ will be **Y**.
    
3. **Tapping a locked center (with enough T$):**  
    When you tap on the pinpoint of a _locked_ center and then choose to “discover” it, if you have enough T$, you will always unlock its info (the pinpoint becomes colorful).
    
4. **Tapping a locked center (without enough T$):**  
    When you tap on the pinpoint of a _locked_ center and then choose to “discover” it, if you don’t have enough T$, you will always be prompted to earn more T$.
    
    - **4.1 – No way to earn T$ through info:**  
        Example: John taps a locked center but has no T$, and it is **impossible** for him to earn T$ by providing information. He will be prompted to earn more T$, and if he accepts, he will face ways to earn T$ through **community growth** (pages_after = **Z**).
        
    - **4.2 – Possible to earn T$ through info:**  
        Example: John taps a locked center but has no T$, and it is **possible** for him to earn T$ by providing information. He will be prompted to earn T$, and if he accepts, he will face ways to earn T$ by **submitting information** (pages_after = **W**).
        
5. **Not logged in + idle usage:**  
    When you are not logged in, and your “accumulated screen time without spending T$ since you last helped by providing any information” reaches 3 minutes, you will always be prompted to create an account (so that your T$ balance can be saved instead of staying in cache).  
    _(account_pages = sign_in_or_sign_up)._
    
6. **Outside radius 1 and 2 of all centers:**  
    When you are not within radius 1 or 2 of any health unit, you will always be informed that the service has not yet grown enough to reach your region.

#### Main Two Pages
The two main pages of the website are:
- **Homepage**: where the user is prompted to either describe their symptoms or go to the map page.
    - If symptoms are entered: the user is taken to the map page, which highlights the health centers best suited to treat those symptoms in the least amount of time.
    - If the user goes directly to the map: the user is taken to the map page showing all health centers, but none are highlighted.
        
- **Map Page**: features a real map centered on the user’s location. From this page onwards, every page includes a login button and the T$ balance in the upper-right corner.  
    At the top of the map there is:
    - A random tip, and above it
    - A text box so the user can (optionally) describe their symptoms again.

### Piece of code
We are dealing with centre pinpoint display. It is not displaying.

App.js
```js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import HomePage from './pages/HomePage';
import MapPage from './pages/MapPage';
import ReadStatusPage from './pages/ReadStatusPage';
import ReadWriteStatusPage from './pages/ReadWriteStatusPage';
import HelpPages from './pages/HelpPages';
import HelpByGrowingCommunity from './pages/HelpByGrowingCommunity';
import AccountPages from './pages/AccountPages';
import { apiClient } from './services/apiClient';
import { useSession } from './hooks/useSession';
import { useGeolocation } from './hooks/useGeolocation';
import { AppContext } from './context/AppContext';
import './styles/global.css';

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, isAuthenticated, login, logout } = useSession();
  const { userLocation, requestLocation } = useGeolocation();
  const didBootstrapRef = useRef(false);

  // Server-driven state
  const [serverState, setServerState] = useState({
    schema: '1',
    balance: 0,
    shows: 'home',
    tutorial: null,
    overlays: [],
    entitlements: [],
    pins: [],
    highlights: [],
    pages_after: null
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [description, setDescription] = useState('');

  // Bootstrap on first load
  useEffect(() => {
    if (didBootstrapRef.current) return;
    didBootstrapRef.current = true;

    (async () => {
      try {
        const response = await apiClient.bootstrap();
        setServerState(prev => ({ ...prev, ...response }));

        // Only let /bootstrap drive navigation when we’re on the entry routes.
        const here = location.pathname || '/';
        const isEntry = here === '/' || here === '/home';
        const target = `/${response.shows || 'home'}`;
        if (isEntry && target !== here) {
          navigate(target, { replace: true });
        }
      } catch (error) {
        console.error('Bootstrap failed:', error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []); // intentionally empty deps (run once)

  // Execute CTA with server token
  const executeCTA = useCallback(async (ctaId, token, payload = {}) => {
    try {
      setIsLoading(true);
      const response = await apiClient.executeCTA(ctaId, token, payload);
      
      // Update balance from server response
      if (response.balance !== undefined) {
        setServerState(prev => ({ ...prev, balance: response.balance }));
      }
      
      return response;
    } catch (error) {
      console.error('CTA execution failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Navigate to map with server flow
  const navigateToMap = useCallback(async (withDescription) => {
    try {
      setIsLoading(true);
     const loc = await requestLocation(); // <-- assume hook returns {lat,lng} or null
     const locationToUse = loc || userLocation || null;

     const flowData = await apiClient.getMapFlow({
       location: locationToUse,
        symptoms: withDescription ? description : undefined
      });
      
      setServerState(prev => ({
        ...prev,
        ...flowData
      }));
      
      navigate('/map');
    } catch (error) {
      console.error('Map flow failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, [description, userLocation, requestLocation, navigate]);

  // Open centre with server decision
  const openCentre = useCallback(async (centreId) => {
    try {
      setIsLoading(true);
      const response = await apiClient.openCentre(centreId, userLocation);
      
      setServerState(prev => ({
        ...prev,
        ...response
      }));
      
      // Navigate based on server's decision
      if (response.shows === 'X') {
        navigate(`/centre/${centreId}/read`);
      } else if (response.shows === 'Y') {
        navigate(`/centre/${centreId}/write`);
      }
      
      return response;
    } catch (error) {
      console.error('Open centre failed:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [userLocation, navigate]);

  // Check for nudges based on dwell time
  const checkNudges = useCallback(async (page, dwellTime, recentActions = []) => {
    try {
      const nudges = await apiClient.getNudges({
        page,
        dwell_sec: dwellTime,
        recent_actions: recentActions
      });
      
      if (nudges.overlays) {
        setServerState(prev => ({
          ...prev,
          overlays: nudges.overlays
        }));
      }
    } catch (error) {
      console.error('Nudges check failed:', error);
    }
  }, []);

  const contextValue = {
    // State
    serverState,
    isLoading,
    description,
    userLocation,
    session,
    isAuthenticated,
    
    // Actions
    setDescription,
    navigateToMap,
    openCentre,
    executeCTA,
    checkNudges,
    login,
    logout,
    
    // Server state updates
    updateServerState: (updates) => setServerState(prev => ({ ...prev, ...updates }))
  };

  if (isLoading && !serverState.schema) {
    return <div className="loading-screen">Loading...</div>;
  }

  return (
    <AppContext.Provider value={contextValue}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/centre/:id/read" element={<ReadStatusPage />} />
        <Route path="/centre/:id/write" element={<ReadWriteStatusPage />} />
        <Route path="/help/*" element={<HelpPages />} />
        <Route path="/grow" element={<HelpByGrowingCommunity />} />
        <Route path="/account/*" element={<AccountPages />} />
      </Routes>
    </AppContext.Provider>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
```

api.js
```js
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

export const callRecommendationAPI = async ({ description, location }) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/recommend`, {
      description,
      location,
      timestamp: new Date().toISOString(),
      headers: { Authorization: `Bearer ${sessionId}` }
    });
    
    return response.data;
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
};

export const fetchHealthCenterStatuses = async () => {
  try {
    const response = await axios.get(`${API_BASE_URL}/health-centers/status`);
    return response.data;
  } catch (error) {
    console.error('Failed to fetch statuses:', error);
    throw error;
  }
};
```

apiClient.js
```js

const API_BASE_URL = (process.env.REACT_APP_API_URL || '').replace(/\/+$/, '');
const join = (base, path) => `${base}${path.startsWith('/') ? path : `/${path}`}`;

class ApiClient {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  async request(endpoint, options = {}) {
    const url = join(this.baseURL, endpoint);
    const config = {
      credentials: 'include',
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    };

    const res = await fetch(url, config);
    const contentType = res.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');

    if (!res.ok) {
      // Try to read JSON error; fall back to text (often HTML)
      let msg = `HTTP ${res.status} ${res.statusText}`;
      try {
        if (isJson) {
          const j = await res.json();
          if (j && j.message) msg = j.message;
        } else {
          const text = await res.text();
          msg = `${msg} — ${text.slice(0, 200)}`;
        }
      } catch {}
      throw new Error(msg);
    }

    if (!isJson) {
      const snippet = await res.text();
      throw new Error(
        `Expected JSON but got ${contentType}. Body starts with: ${snippet.slice(0, 120)}`
      );
    }

    return res.json();
  }

  // Bootstrap - called on app load
  async bootstrap() {
    return this.request('/bootstrap', {
      method: 'POST',
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      })
    });
  }

  // Get map flow data
  async getMapFlow({ location, symptoms }) {
    return this.request('/flow/map', {
      method: 'POST',
      body: JSON.stringify({
        location,
        symptoms,
        timestamp: new Date().toISOString()
      })
    });
  }

  // Open a centre - server decides X or Y
  async openCentre(centreId, location) {
    return this.request(`/centre/${centreId}/open`, {
      method: 'POST',
      body: JSON.stringify({
        location,
        timestamp: new Date().toISOString()
      })
    });
  }

  // Execute a CTA with token
  async executeCTA(ctaId, token, payload = {}) {
    return this.request('/cta/execute', {
      method: 'POST',
      body: JSON.stringify({
        cta_id: ctaId,
        token,
        payload,
        timestamp: new Date().toISOString()
      })
    });
  }

  // Get nudges based on dwell time
  async getNudges({ page, dwell_sec, recent_actions }) {
    return this.request('/flow/nudges', {
      method: 'POST',
      body: JSON.stringify({
        page,
        dwell_sec,
        recent_actions,
        timestamp: new Date().toISOString()
      })
    });
  }

  // Get help flow plan
  async getHelpPlan(centreId, entry_point) {
    return this.request('/help/plan', {
      method: 'POST',
      body: JSON.stringify({
        centre_id: centreId,
        entry_point,
        timestamp: new Date().toISOString()
      })
    });
  }

  // Auth endpoints
  async signUp({ username, password, email, referral_code }) {
    return this.request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({
        username,
        password,
        email,
        referral_code
      })
    });
  }

  async signIn({ username, password }) {
    return this.request('/auth/signin', {
      method: 'POST',
      body: JSON.stringify({
        username,
        password
      })
    });
  }

  async signOut() {
    return this.request('/auth/signout', {
      method: 'POST'
    });
  }

  async getProfile() {
    return this.request('/auth/profile', {
      method: 'GET'
    });
  }

  // Search treatments
  async searchTreatments(centreId, query) {
    return this.request(`/centre/${centreId}/treatments/search`, {
      method: 'POST',
      body: JSON.stringify({ query })
    });
  }

  // Get centre read data
  async getCentreReadData(centreId) {
    return this.request(`/centre/${centreId}/read`, {
      method: 'GET'
    });
  }

  // Get referral link
  async getReferralLink() {
    return this.request('/referral/link', {
      method: 'GET'
    });
  }
}

export const apiClient = new ApiClient();
```

MapPage.js
```js
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useDwellTime } from '../hooks/useDwellTime';
import Logo from '../components/Logo';
import TextInput from '../components/TextInput';
import IconButton from '../components/IconButton';
import InfoBanner from '../components/InfoBanner';
import HealthMap from '../components/HealthMap';
import AccountButton from '../components/AccountButton';
import BalanceDisplay from '../components/BalanceDisplay';
import Overlay from '../components/Overlay';
import Tutorial from '../components/Tutorial';
import LocationPermissionModal from '../components/LocationPermissionModal';
import { RefreshIcon } from '../components/Icons';
import './MapPage.css';

const MapPage = () => {
  const navigate = useNavigate();
  const {
    serverState,
    description,
    setDescription,
    userLocation,
    isAuthenticated,
    openCentre,
    executeCTA,
    checkNudges,
    navigateToMap
  } = useApp();
  
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [selectedPin, setSelectedPin] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Track dwell time for nudges
  const dwellTimeThresholds = [
    { id: 'idle_3min', seconds: 180, type: 'idle' }
  ];

  const handleDwellThreshold = useCallback(async ({ id }) => {
    if (id === 'idle_3min' && !isAuthenticated) {
      await checkNudges('map', 180, []);
    }
  }, [checkNudges, isAuthenticated]);

  const { resetActivity } = useDwellTime(handleDwellThreshold, dwellTimeThresholds);

  // Request location on mount if not already available
  useEffect(() => {
    if (!userLocation && !showLocationModal && serverState.pins.length === 0) {
      setShowLocationModal(true);
    }
  }, [userLocation, showLocationModal, serverState.pins.length]);

  // Handle location permission response
  const handleLocationResponse = useCallback(async (granted) => {
    setShowLocationModal(false);
   if (granted && serverState.pins.length === 0) {
     await navigateToMap(description.length > 0);
   }
  }, [navigateToMap, description, serverState.pins.length]);

  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    resetActivity();
    await navigateToMap(description.length > 0);
    setIsRefreshing(false);
  };

  // Handle pin click
  const handlePinClick = useCallback((pin) => {
    setSelectedPin(pin);
    resetActivity();
  }, [resetActivity]);

  // Handle discover action
  const handleDiscover = useCallback(async () => {
    if (!selectedPin) return;
    
    const entitlement = serverState.entitlements.find(
      e => e.cta === 'discover' && e.centre_id === selectedPin.id
    );
    
    if (entitlement) {
      try {
        await executeCTA('discover', entitlement.token, {
          centre_id: selectedPin.id
        });
        // Refresh map data after discovery
        await navigateToMap(description.length > 0);
      } catch (error) {
        console.error('Discover failed:', error);
      }
    }
    
    setSelectedPin(null);
  }, [selectedPin, serverState.entitlements, executeCTA, navigateToMap, description]);

  // Handle +info action
  const handleMoreInfo = useCallback(async () => {
    if (!selectedPin) return;
    
    try {
      await openCentre(selectedPin.id);
    } catch (error) {
      console.error('Open centre failed:', error);
    }
    
    setSelectedPin(null);
  }, [selectedPin, openCentre]);

  // Handle go to centre action
  const handleGoToCentre = useCallback(() => {
    if (!selectedPin) return;
    
    // Open navigation modal/sheet
    const destinations = ['Google Maps', 'Waze', 'Uber'];
    const choice = prompt(`Open with:\n${destinations.join('\n')}`);
    
    if (choice) {
      const urls = {
        'Google Maps': userLocation 
          ? `https://www.google.com/maps/dir/${userLocation.lat},${userLocation.lng}/${selectedPin.lat},${selectedPin.lng}`
          : `https://www.google.com/maps/search/?api=1&query=${selectedPin.lat},${selectedPin.lng}`,
        'Waze': `https://waze.com/ul?ll=${selectedPin.lat},${selectedPin.lng}&navigate=yes`,
        'Uber': `https://m.uber.com/ul/?action=setPickup&dropoff[latitude]=${selectedPin.lat}&dropoff[longitude]=${selectedPin.lng}`
      };
      
      if (urls[choice]) {
        window.open(urls[choice], '_blank');
      }
    }
    
    setSelectedPin(null);
  }, [selectedPin, userLocation]);

  // Handle overlay actions
  const handleOverlayAction = useCallback(async (overlay, action) => {
    if (action === 'earn_more') {
      navigate('/help/available-treatment');
    } else if (action === 'sign_in') {
      navigate('/account/signin');
    } else if (action === 'discover' && overlay.centre_id) {
      setSelectedPin(serverState.pins.find(p => p.id === overlay.centre_id));
    }
  }, [navigate, serverState.pins]);

  // Get random tip
  const getRandomTip = () => {
    const tips = [
      "Did you know? It's your right to be taken care of at the health center unit you go (Doesn't matter if they told you to go see a doctor at your neighbourhood)",
      "Tip: You can help others by sharing how full the health center is right now",
      "Remember: Every information you share helps the community save time"
    ];
    return tips[Math.floor(Math.random() * tips.length)];
  };

  return (
    <div className="map-page">
      {/* Header */}
      <div className="map-header">
        <Logo size="small" />
        <span className="service-name">Less Time</span>
        <div className="header-actions">
          <AccountButton />
          <BalanceDisplay balance={serverState.balance} />
        </div>
      </div>
      
      {/* Rewrite section */}
      <div className="rewrite-section">
        <span className="rewrite-label">rewrite (describe again)</span>
        <div className="rewrite-input-wrapper">
          <TextInput
            value={description}
            onChange={setDescription}
            placeholder="Describe symptoms..."
            maxLength={300}
            variant="compact"
          />
          <IconButton
            icon={<RefreshIcon />}
            onClick={handleRefresh}
            disabled={isRefreshing}
            label="Refresh recommendations"
          />
        </div>
      </div>
      
      {/* Info banner with random tip */}
      <InfoBanner>
        <strong>Did you know?</strong> {getRandomTip()}
      </InfoBanner>
      
      {/* Map */}
      <HealthMap
        pins={serverState.pins}
        highlights={serverState.highlights}
        userLocation={userLocation}
        onPinClick={handlePinClick}
        selectedPin={selectedPin}
      />
      
      {/* Pin overlay bubble */}
      {selectedPin && (
        <Overlay
          pin={selectedPin}
          onClose={() => setSelectedPin(null)}
          onDiscover={handleDiscover}
          onMoreInfo={handleMoreInfo}
          onGoToCentre={handleGoToCentre}
          canDiscover={serverState.entitlements.some(
            e => e.cta === 'discover' && e.centre_id === selectedPin.id
          )}
        />
      )}
      
      {/* Server-driven overlays */}
      {serverState.overlays.map((overlay, index) => (
        <Overlay
          key={index}
          {...overlay}
          onAction={(action) => handleOverlayAction(overlay, action)}
        />
      ))}
      
      {/* Tutorial */}
      {serverState.tutorial?.map && (
        <Tutorial 
          steps={serverState.tutorial.map}
          onComplete={() => {
            // Tutorial completion handled by server
          }}
        />
      )}
      
      {/* Location permission modal */}
      {showLocationModal && (
        <LocationPermissionModal
          onResponse={handleLocationResponse}
        />
      )}
    </div>
  );
};

export default MapPage;
```

api_handler.py
```py
"""
AWS Lambda handler for Health Waze API
Server-driven UI implementation with business rules
"""

import json
import os
import time
from decimal import Decimal
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import boto3
import jwt
from boto3.dynamodb.conditions import Key

# DynamoDB tables
DDB_ENDPOINT = os.environ.get('DYNAMODB_ENDPOINT')
dynamodb = boto3.resource('dynamodb', endpoint_url=DDB_ENDPOINT)
users_table = dynamodb.Table(os.environ['USERS_TABLE'])
sessions_table = dynamodb.Table(os.environ['SESSIONS_TABLE'])
centres_table = dynamodb.Table(os.environ['CENTRES_TABLE'])
ledger_table = dynamodb.Table(os.environ['LEDGER_TABLE'])
entitlements_table = dynamodb.Table(os.environ['ENTITLEMENTS_TABLE'])

# Constants
SECRET_KEY = os.environ['JWT_SECRET']
RADIUS_1_METERS = 50
RADIUS_2_KM = 7
RADIUS_3_KM = 13

# T$ amounts
DISCOVER_COST = 60
FIRST_LOCATION_BONUS = 60
SIGNUP_REFERRAL_BONUS = 50

# Help earnings calculation
def calculate_help_earnings(centre_type: str, help_type: str, radius3_count: int) -> int:
    """Calculate T$ earnings based on centre type and help action"""
    if centre_type == 'A':
        total = 60 * radius3_count
        earnings = {
            'help.fullness_info': int(0.35 * total),
            'help.treatment_available': int(0.30 * total),
            'help.amount_doctors': int(0.075 * total),
            'help.doctors_on_call': int(0.075 * total),
            'help.drug_confirm': int(0.08 * total),
            'help.drug_deny': int(0.08 * total),
            'help.drug_add': int(0.04 * total),
            'help.doctor_confirm': int(0.08 * total),
            'help.doctor_deny': int(0.08 * total),
        }
    else:  # Type B
        total = 60 * radius3_count
        earnings = {
            'help.fullness_info': int(0.35 * total),
            'help.treatment_available': int(0.30 * total),
            'help.drug_confirm': int(0.25 * total / 2),  # Split for 2 per hour
            'help.drug_deny': int(0.25 * total / 2),
            'help.drug_add': int(0.10 * total),
        }
    
    return earnings.get(help_type, 0)

def calculate_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate distance between two points in kilometers"""
    from math import radians, sin, cos, sqrt, atan2
    
    R = 6371  # Earth's radius in km
    lat1, lng1, lat2, lng2 = map(radians, [lat1, lng1, lat2, lng2])
    dlat = lat2 - lat1
    dlng = lng2 - lng1
    
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlng/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    
    return R * c

def get_user_radius_context(user_location: Dict, centres: List[Dict]) -> Dict:
    """Determine user's radius context for all centres"""
    context = {
        'radius1_centres': [],
        'radius2_centres': [],
        'radius3_centres': [],
        'radius3_count': 0
    }
    
    if not user_location:
        return context
    
    user_lat = user_location['lat']
    user_lng = user_location['lng']
    
    for centre in centres:
        distance_km = calculate_distance(
            user_lat, user_lng,
            centre['lat'], centre['lng']
        )
        distance_m = distance_km * 1000
        
        if distance_m <= RADIUS_1_METERS:
            context['radius1_centres'].append(centre['id'])
        elif distance_km <= RADIUS_2_KM:
            context['radius2_centres'].append(centre['id'])
        elif distance_km <= RADIUS_3_KM:
            context['radius3_centres'].append(centre['id'])
    
    context['radius3_count'] = len(context['radius3_centres'])
    return context

def lambda_handler(event, context):
    """Main Lambda handler with routing (works for REST v1 and HTTP v2)"""
    # Path
    path = event.get('path') or event.get('rawPath') or '/'
    for prefix in ('/dev', '/prod', '/staging'):
        if path.startswith(prefix + '/'):
            path = path[len(prefix):]
            break

    # Method
    if 'httpMethod' in event:  # REST v1
        method = event['httpMethod']
    else:  # HTTP v2
        method = (event.get('requestContext', {})
                      .get('http', {})
                      .get('method', 'GET'))

    # Body (handle base64 + non-JSON)
    body_raw = event.get('body') or '{}'
    if event.get('isBase64Encoded'):
        import base64
        body_raw = base64.b64decode(body_raw).decode('utf-8')
    try:
        body = json.loads(body_raw) if isinstance(body_raw, str) else (body_raw or {})
    except json.JSONDecodeError:
        body = {}

    # Headers (be lenient on casing)
    headers = event.get('headers') or {}
    auth = headers.get('Authorization') or headers.get('authorization')
    if auth and auth.startswith('Bearer '):
        session_token = auth.split(' ', 1)[1]
    cookie_header = headers.get('Cookie') or headers.get('cookie') or ''

    # Extract session from cookie
    session_token = None
    if cookie_header:
        for cookie in cookie_header.split('; '):
            if cookie.startswith('session='):
                session_token = cookie.split('=', 1)[1]
                break
    
    # Route to appropriate handler
    if path == '/bootstrap' and method == 'POST':
        return handle_bootstrap(body, session_token)
    elif path == '/flow/map' and method == 'POST':
        return handle_flow_map(body, session_token)
    elif path.startswith('/centre/') and path.endswith('/open') and method == 'POST':
        centre_id = path.split('/')[2]
        return handle_open_centre(centre_id, body, session_token)
    elif path == '/cta/execute' and method == 'POST':
        return handle_cta_execute(body, session_token)
    elif path == '/flow/nudges' and method == 'POST':
        return handle_nudges(body, session_token)
    elif path == '/help/plan' and method == 'POST':
        return handle_help_plan(body, session_token)
    else:
        return {
            'statusCode': 404,
            'body': json.dumps({'error': 'Not found'})
        }

def handle_bootstrap(body: Dict, session_token: Optional[str]) -> Dict:
    """Handle bootstrap - initial app load"""
    # Get or create session
    session = get_or_create_session(session_token)
    user_state = get_user_state(session['user_id'])
    
    # Determine if first access
    is_first_access = user_state.get('first_access_time') is None
    
    response = {
        'schema': '1',
        'balance': user_state.get('balance', 0),
        'shows': 'home',
        'first_access': is_first_access,
        'tutorial': {}
    }
    
    if is_first_access:
        # Mark first access
        users_table.update_item(
            Key={'user_id': session['user_id']},
            UpdateExpression='SET first_access_time = :time',
            ExpressionAttributeValues={':time': datetime.utcnow().isoformat()}
        )
        
        response['tutorial']['home'] = [
            {
                'message': 'Welcome to Health Waze! Save time finding healthcare.',
                'position': {'top': '50%', 'left': '50%'}
            }
        ]
    
    return {
        'statusCode': 200,
        'headers': {
            'Set-Cookie': f"session={session['session_id']}; HttpOnly; Secure; SameSite=Strict; Path=/",
            'Content-Type': 'application/json'
        },
        'body':json_dumps_safe(response)
    }

# small hot-cache with TTL; survives across warm invocations
_CENTRES_CACHE = {
    "items": None,
    "expires_at": 0.0,
    "ttl_seconds": 30.0,   # tune as you like; centres are basically static
}

def _now_epoch() -> float:
    return time.time()

def _normalize_centre_item(it: Dict) -> Optional[Dict]:
    """
    Convert a raw DynamoDB item to a normalized centre dict.
    Skips malformed/disabled records gracefully.
    """
    if not it or it.get("disabled") is True:
        return None

    try:
        lat = float(it["lat"])
        lng = float(it["lng"])
    except (KeyError, TypeError, ValueError):
        # Skip if location is missing or invalid
        return None

    return {
        "id": it["id"],
        "name": it.get("name", it["id"]),
        "lat": lat,
        "lng": lng,
        "type": it.get("type", "A"),
        # Status fields are optional; keep as-is if present
        "status": it.get("status"),
        "last_update": it.get("last_update"),
    }

def get_all_centres() -> List[Dict]:
    """
    Return every centre (as normalized dicts) from DynamoDB.
    Uses a short in-memory cache for warm Lambda invocations.
    """
    global _CENTRES_CACHE
    if _CENTRES_CACHE["items"] and _now_epoch() < _CENTRES_CACHE["expires_at"]:
        return _CENTRES_CACHE["items"]

    items: List[Dict] = []
    scan_kwargs: Dict = {}
    while True:
        resp = centres_table.scan(**scan_kwargs)
        items.extend(resp.get("Items", []))
        lek = resp.get("LastEvaluatedKey")
        if not lek:
            break
        scan_kwargs["ExclusiveStartKey"] = lek

    centres: List[Dict] = []
    for it in items:
        n = _normalize_centre_item(it)
        if n:
            centres.append(n)

    # cache the normalized list
    _CENTRES_CACHE["items"] = centres
    _CENTRES_CACHE["expires_at"] = _now_epoch() + _CENTRES_CACHE["ttl_seconds"]
    return centres

def get_centre(centre_id: str) -> Optional[Dict]:
    """Fetch a single centre by id (normalized)."""
    resp = centres_table.get_item(Key={"id": centre_id})
    it = resp.get("Item")
    return _normalize_centre_item(it) if it else None

def get_unlocked_centres(user_id: str) -> List[str]:
    """
    Minimal implementation: read a 'unlocked_centres' list from the user item.
    If absent, return empty list (pins will still render as locked).
    """
    try:
        resp = users_table.get_item(Key={"user_id": user_id}, ProjectionExpression="unlocked_centres")
        item = resp.get("Item") or {}
        unlocked = item.get("unlocked_centres") or []
        # DynamoDB string sets may arrive as set(...); normalize to list
        return list(unlocked) if not isinstance(unlocked, list) else unlocked
    except Exception:
        return []

def check_can_earn_by_info(user_id: str, radius_ctx: Dict) -> bool:
    """
    Conservative stub so low-balance overlay logic won't crash.
    You can expand this later with the full rules you outlined.
    """
    return bool(radius_ctx.get("radius1_centres") or radius_ctx.get("radius2_centres"))

def handle_flow_map(body: Dict, session_token: str) -> Dict:
    session = get_or_create_session(session_token)
    user_state = get_user_state(session['user_id'])
    location = body.get('location')

    centres = get_all_centres()                  # ← implemented
    radius_ctx = get_user_radius_context(location, centres)
    unlocked = get_unlocked_centres(session['user_id'])  # ← implemented

    pins = []
    for c in centres:
        pin = {
            'id': c['id'],
            'name': c['name'],
            'lat': float(c['lat']),
            'lng': float(c['lng']),
            'locked': c['id'] not in unlocked,
            'type': c.get('type', 'A'),
        }
        # status only when unlocked or user currently in radius1 (read rules)
        if (not pin['locked']) or (c['id'] in radius_ctx['radius1_centres']):
            pin['status'] = c.get('status')
            pin['lastUpdate'] = c.get('last_update')
        pins.append(pin)

    highlights = []

    entitlements = []
    if user_state.get('balance', 0) >= DISCOVER_COST:
        for c in centres:
            if c['id'] in unlocked:
                continue
            entitlements.append({
                'cta': 'discover',
                'centre_id': c['id'],
                'token': generate_cta_token(
                    session['user_id'], 'discover', c['id'], radius_ctx['radius3_count']
                ),
                'limit': '1/h',
            })

    response = {
        'schema': '1',
        'pins': pins,
        'highlights': highlights,
        'overlays': [],
        'entitlements': entitlements,
        'pages_after': None
    }

    if location and user_state.get('first_location_shared') is None:
        credit_user_balance(session['user_id'], FIRST_LOCATION_BONUS, 'first_location_share')
        response['overlays'].append({
            'type': 'success',
            'message': 'Congrats! You earned 1 hour.',
            'position': {'top': '20%', 'left': '50%'}
        })
        users_table.update_item(
            Key={'user_id': session['user_id']},
            UpdateExpression='SET first_location_shared = :true',
            ExpressionAttributeValues={':true': True}
        )
        response['tutorial'] = {
            'map': [
                {
                    'message': 'Tap a grey pin to discover if it\'s full or not',
                    'highlight': {'selector': '.health-marker--locked'},
                    'finger': {'top': '50%', 'left': '50%', 'animation': 'tap'}
                }
            ]
        }

    if user_state.get('balance', 0) < DISCOVER_COST:
        # FIX: use radius_ctx (not radius_context)
        can_earn = check_can_earn_by_info(session['user_id'], radius_ctx)
        if can_earn:
            response['overlays'].append({
                'type': 'cta',
                'copy_key': 'It seems you don\'t have enough Time $aved',
                'actions': [
                    {'id': 'earn_more', 'label': 'Earn more', 'variant': 'primary'}
                ],
                'anchor': 'balance'
            })

    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json'},
        'body': json_dumps_safe(response)   # safer for any Decimal left around
    }

def json_dumps_safe(obj):
    """json.dumps that converts Decimal -> int/float recursively"""
    def convert(o):
        if isinstance(o, list):
            return [convert(i) for i in o]
        if isinstance(o, dict):
            return {k: convert(v) for k, v in o.items()}
        if isinstance(o, Decimal):
            return int(o) if o % 1 == 0 else float(o)
        return o
    return json.dumps(convert(obj))

def handle_open_centre(centre_id: str, body: Dict, session_token: str) -> Dict:
    """Handle opening a centre - decides X vs Y pages"""
    # session = get_session(session_token)
    session = get_or_create_session(session_token)
    location = body.get('location')
    
    # Get centre and user context
    # centre = get_centre(centre_id)
    # radius_context = get_user_radius_context(location, [centre])
    
    # Determine page type
    # if centre_id in radius_context['radius1_centres']:
    #     shows = 'Y'  # ReadWrite page
    #     entitlements = generate_write_entitlements(
    #         session['user_id'],
    #         centre_id,
    #         centre['type'],
    #         radius_context['radius3_count']
    #     )
    # else:
    #     shows = 'X'  # ReadOnly page
    #     entitlements = []
    
    # Auto-unlock if in radius1
    # if centre_id in radius_context['radius1_centres']:
        # unlock_centre(session['user_id'], centre_id, 'radius1')
    
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json'},
        'body': json.dumps({
            # 'shows': shows,
            'shows': 'X',
            # 'entitlements': entitlements
            'entitlements': []
        })
    }

def handle_cta_execute(body: Dict, session_token: str) -> Dict:
    """Execute a CTA with token validation"""
    # session = get_session(session_token)
    session = get_or_create_session(session_token)
    cta_id = body['cta_id']
    token = body['token']
    payload = body.get('payload', {})
    
    # Validate token
    try:
        claims = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        
        # Verify token claims
        if claims['sub'] != session['user_id']:
            raise ValueError('Token user mismatch')
        if claims['cta'] != cta_id:
            raise ValueError('Token CTA mismatch')
        if claims.get('centre_id') != payload.get('centre_id'):
            raise ValueError('Token centre mismatch')
            
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError, ValueError) as e:
        return {
            'statusCode': 403,
            'body': json.dumps({'error': 'Invalid or expired token'})
        }
    
    # Execute CTA based on type
    if cta_id == 'discover':
        result = execute_discover(session['user_id'], payload['centre_id'])
    elif cta_id.startswith('help.'):
        result = execute_help_action(session['user_id'], cta_id, payload, claims)
    else:
        return {
            'statusCode': 400,
            'body': json.dumps({'error': 'Unknown CTA'})
        }
    
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json'},
        'body': json.dumps(result)
    }

def execute_discover(user_id: str, centre_id: str) -> Dict:
    """Execute discover action - unlock a centre"""
    user_state = get_user_state(user_id)
    
    # Check balance
    if user_state['balance'] < DISCOVER_COST:
        raise ValueError('Insufficient balance')
    
    # Deduct cost
    # debit_user_balance(user_id, DISCOVER_COST, f'discover:{centre_id}')
    
    # Unlock centre  
    # unlock_centre(user_id, centre_id, 'radius2')
    
    # Get updated balance
    new_balance = user_state['balance'] - DISCOVER_COST
    
    return {
        'success': True,
        'balance': new_balance,
        'message': 'Centre unlocked!'
    }

def execute_help_action(user_id: str, cta_id: str, payload: Dict, claims: Dict) -> Dict:
    """Execute a help action"""
    centre_id = payload['centre_id']
    # centre = get_centre(centre_id)
    
    # Check rate limits
    # if not check_help_rate_limit(user_id, centre_id, cta_id):
        # raise ValueError('Rate limit exceeded')
    
    # Calculate earnings
    radius3_count = claims.get('radius3_count', 5)
    # earn_amount = calculate_help_earnings(centre['type'], cta_id, radius3_count)
    
    # Immediate vs validated earnings
    if cta_id == 'help.treatment_available':
        # Full immediate credit
        # credit_user_balance(user_id, earn_amount, f'{cta_id}:{centre_id}')
        validation_due_at = None
    # else:
        # 25% immediate, 75% on validation
        # immediate = int(earn_amount * 0.25)
        # pending = earn_amount - immediate
        
        # credit_user_balance(user_id, immediate, f'{cta_id}:{centre_id}:immediate')
        
        # Schedule validation
        # validation_time = get_next_validation_time()
        # create_pending_validation(user_id, centre_id, cta_id, pending, validation_time)
        
        # validation_due_at = validation_time.isoformat()
    
    # Record help action
    # record_help_action(user_id, centre_id, cta_id, payload)
    
    # Get updated balance
    user_state = get_user_state(user_id)
    
    return {
        'success': True,
        'balance': user_state['balance'],
        # 'earn_amount': format_time_amount(earn_amount),
        'earn_amount': format_time_amount(60),
        'validation_due_at': validation_due_at
    }

def generate_write_entitlements(user_id: str, centre_id: str, centre_type: str, radius3_count: int) -> List[Dict]:
    """Generate CTA entitlements for write actions"""
    entitlements = []
    current_hour = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
    
    # Check what help is available
    # help_counts = get_help_counts(user_id, centre_id, current_hour)
    
    # Treatment available (once per day)
    # if not help_counts.get('treatment_today'):
    if True:
        token = generate_cta_token(user_id, 'help.treatment_available', centre_id, radius3_count)
        entitlements.append({
            'cta': 'help.treatment_available',
            'token': token,
            'available': True,
            'earn_amount': format_time_amount(
                calculate_help_earnings(centre_type, 'help.treatment_available', radius3_count)
            )
        })
    
    # Fullness info (once per hour)
    # if not help_counts.get('fullness_this_hour'):
    if True:
        token = generate_cta_token(user_id, 'help.fullness_info', centre_id, radius3_count)
        entitlements.append({
            'cta': 'help.fullness_info',
            'token': token,
            'available': True,
            'earn_amount': format_time_amount(
                calculate_help_earnings(centre_type, 'help.fullness_info', radius3_count)
            )
        })
    
    # Add other entitlements based on centre type...
    
    return entitlements

def generate_cta_token(user_id: str, cta: str, centre_id: str, radius3_count: int) -> str:
    """Generate a short-lived CTA token"""
    exp = datetime.utcnow() + timedelta(minutes=10)
    
    payload = {
        'sub': user_id,
        'cta': cta,
        'centre_id': centre_id,
        'radius3_count': radius3_count,
        'exp': exp,
        'iat': datetime.utcnow()
    }
    
    return jwt.encode(payload, SECRET_KEY, algorithm='HS256')

def format_time_amount(minutes: int) -> str:
    """Format minutes as human-readable time"""
    if minutes < 60:
        return f"{minutes} minutes"
    hours = minutes // 60
    mins = minutes % 60
    if mins == 0:
        return f"{hours} hour{'s' if hours > 1 else ''}"
    return f"{hours}h {mins}min"

# Helper functions for data access
def get_or_create_session(session_token: Optional[str]) -> Dict:
    """Get existing session or create new anonymous one"""
    if session_token:
        try:
            response = sessions_table.get_item(Key={'session_id': session_token})
            if 'Item' in response:
                return response['Item']
        except:
            pass
    
    # Create new anonymous session
    import uuid
    session_id = str(uuid.uuid4())
    user_id = f"anon_{uuid.uuid4()}"
    
    # Create anonymous user
    users_table.put_item(Item={
        'user_id': user_id,
        'anonymous': True,
        'balance': 0,
        'created_at': datetime.utcnow().isoformat()
    })
    
    # Create session
    sessions_table.put_item(Item={
        'session_id': session_id,
        'user_id': user_id,
        'created_at': datetime.utcnow().isoformat(),
        'ttl': int((datetime.utcnow() + timedelta(days=30)).timestamp())
    })
    
    return {'session_id': session_id, 'user_id': user_id}

def get_user_state(user_id: str) -> Dict:
    """Get complete user state"""
    response = users_table.get_item(Key={'user_id': user_id})
    return response.get('Item', {'balance': 0})

def credit_user_balance(user_id: str, amount: int, reason: str):
    """Add to user balance and record in ledger"""
    # Update balance
    users_table.update_item(
        Key={'user_id': user_id},
        UpdateExpression='ADD balance :amount',
        ExpressionAttributeValues={':amount': amount}
    )
    
    # Record in ledger
    ledger_table.put_item(Item={
        'ledger_id': f"{user_id}#{datetime.utcnow().isoformat()}",
        'user_id': user_id,
        'amount': amount,
        'type': 'credit',
        'reason': reason,
        'timestamp': datetime.utcnow().isoformat()
    })

# ... Additional helper functions would be implemented ...
```

### Solve
at `locahost:3003/map`
Pinpoints aren't displayed.
They aren't even data in table.
Populate the table according to what frontend and backend expects.

Consider that any centre [status hsitory, current staatus, available doctors, amount of available doctors, available drugs] are infos updated hourly considering statistical analysis of what all users told about these attributes (i.e. they are user provided info for community) -- so if no users are in a centre in a given hour, these could be lacking info. Anyway, this doesn't make the centre not exist. Users may have control over their info, but never on their identity (made of their name and location).

Centre identities:
```
[
  { 
    name: "CIAMS Urias Magalhães", 
    lat: -16.6514931, 
    lng: -49.3280203 
  },
  { 
    name: "CAIS Cândida de Moraes", 
    lat: -16.6121551, 
    lng: -49.3427299 
  },
  { 
    name: "UBS Jardim América", 
    lat: -16.635675, 
    lng: -49.2749015 
  },
  { 
    name: "CAIS Novo Mundo", 
    lat: -16.6179383, 
    lng: -49.3535845 
  },
  { 
    name: "CAIS Campinas", 
    lat: -16.667448, 
    lng: -49.277836 
  },
  { 
    name: "UBS Setor Oeste", 
    lat: -16.6892, 
    lng: -49.2654 
  },
  { 
    name: "CIAMS Pedro Ludovico", 
    lat: -16.6423, 
    lng: -49.3156 
  },
  { 
    name: "UBS Vila Nova", 
    lat: -16.6789, 
    lng: -49.2987 
  }
];

```

Manual script:
```py
"""
Script to set up local DynamoDB tables for development
Run this after starting docker-compose
"""

import boto3
import os
import sys
from datetime import datetime

# Local DynamoDB configuration
DYNAMODB_ENDPOINT = os.environ.get('DYNAMODB_ENDPOINT', 'http://localhost:8000')
AWS_REGION = os.environ.get('AWS_REGION', 'us-east-1')

# Table definitions
TABLES = [
    {
        'TableName': 'health-waze-users-dev',
        'KeySchema': [
            {'AttributeName': 'user_id', 'KeyType': 'HASH'}
        ],
        'AttributeDefinitions': [
            {'AttributeName': 'user_id', 'AttributeType': 'S'}
        ],
        'BillingMode': 'PAY_PER_REQUEST'
    },
    {
        'TableName': 'health-waze-sessions-dev',
        'KeySchema': [
            {'AttributeName': 'session_id', 'KeyType': 'HASH'}
        ],
        'AttributeDefinitions': [
            {'AttributeName': 'session_id', 'AttributeType': 'S'}
        ],
        'BillingMode': 'PAY_PER_REQUEST'
    },
    {
        'TableName': 'health-waze-centres-dev',
        'KeySchema': [
            {'AttributeName': 'id', 'KeyType': 'HASH'}
        ],
        'AttributeDefinitions': [
            {'AttributeName': 'id', 'AttributeType': 'S'}
        ],
        'BillingMode': 'PAY_PER_REQUEST'
    },
    {
        'TableName': 'health-waze-ledger-dev',
        'KeySchema': [
            {'AttributeName': 'ledger_id', 'KeyType': 'HASH'}
        ],
        'AttributeDefinitions': [
            {'AttributeName': 'ledger_id', 'AttributeType': 'S'},
            {'AttributeName': 'user_id', 'AttributeType': 'S'},
            {'AttributeName': 'timestamp', 'AttributeType': 'S'}
        ],
        'GlobalSecondaryIndexes': [
            {
                'IndexName': 'user-timestamp-index',
                'KeySchema': [
                    {'AttributeName': 'user_id', 'KeyType': 'HASH'},
                    {'AttributeName': 'timestamp', 'KeyType': 'RANGE'}
                ],
                'Projection': {'ProjectionType': 'ALL'}
            }
        ],
        'BillingMode': 'PAY_PER_REQUEST'
    },
    {
        'TableName': 'health-waze-entitlements-dev',
        'KeySchema': [
            {'AttributeName': 'entitlement_id', 'KeyType': 'HASH'}
        ],
        'AttributeDefinitions': [
            {'AttributeName': 'entitlement_id', 'AttributeType': 'S'},
            {'AttributeName': 'user_id', 'AttributeType': 'S'}
        ],
        'GlobalSecondaryIndexes': [
            {
                'IndexName': 'user-index',
                'KeySchema': [
                    {'AttributeName': 'user_id', 'KeyType': 'HASH'}
                ],
                'Projection': {'ProjectionType': 'ALL'}
            }
        ],
        'BillingMode': 'PAY_PER_REQUEST'
    },
    {
        'TableName': 'health-waze-connections-dev',
        'KeySchema': [
            {'AttributeName': 'connection_id', 'KeyType': 'HASH'}
        ],
        'AttributeDefinitions': [
            {'AttributeName': 'connection_id', 'AttributeType': 'S'}
        ],
        'BillingMode': 'PAY_PER_REQUEST'
    }
]

def create_tables():
    """Create all DynamoDB tables for local development"""
    # Connect to local DynamoDB
    dynamodb = boto3.resource(
        'dynamodb',
        endpoint_url=DYNAMODB_ENDPOINT,
        region_name=AWS_REGION,
        aws_access_key_id='local',
        aws_secret_access_key='local'
    )
    
    # Get existing tables
    existing_tables = []
    try:
        existing_tables = [table.name for table in dynamodb.tables.all()]
    except Exception as e:
        print(f"Error listing tables: {e}")
        print("Make sure DynamoDB Local is running (docker-compose up)")
        sys.exit(1)
    
    # Create each table
    for table_def in TABLES:
        table_name = table_def['TableName']
        
        if table_name in existing_tables:
            print(f"✓ Table {table_name} already exists")
            continue
        
        try:
            # Create table
            table = dynamodb.create_table(**table_def)
            
            # Wait for table to be created
            print(f"Creating table {table_name}...")
            table.wait_until_exists()
            print(f"✓ Table {table_name} created successfully")
            
        except Exception as e:
            print(f"✗ Error creating table {table_name}: {e}")
            sys.exit(1)

def verify_tables():
    """Verify all tables were created successfully"""
    dynamodb = boto3.resource(
        'dynamodb',
        endpoint_url=DYNAMODB_ENDPOINT,
        region_name=AWS_REGION,
        aws_access_key_id='local',
        aws_secret_access_key='local'
    )
    
    print("\nVerifying tables...")
    
    for table_def in TABLES:
        table_name = table_def['TableName']
        try:
            table = dynamodb.Table(table_name)
            table.load()
            print(f"✓ {table_name}: {table.table_status}")
        except Exception as e:
            print(f"✗ {table_name}: Error - {e}")

def main():
    """Main function"""
    print("=== Health Waze Local Database Setup ===")
    print(f"DynamoDB Endpoint: {DYNAMODB_ENDPOINT}")
    print(f"AWS Region: {AWS_REGION}")
    print()
    
    # Create tables
    create_tables()
    
    # Verify creation
    verify_tables()
    
    print("\n✓ Local database setup complete!")
    print("\nNext steps:")
    print("1. Run seed data: npm run seed:local")
    print("2. Start backend: npm run dev")
    print("3. View DynamoDB Admin at: http://localhost:8001")

if __name__ == '__main__':
    main()
```
