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