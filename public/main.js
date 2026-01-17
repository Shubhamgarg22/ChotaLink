// ========================================
// MODERN URL SHORTENER - MODULAR ARCHITECTURE
// ========================================

/**
 * FirebaseService - Handles all Firebase operations
 */
class FirebaseService {
  constructor() {
    this.db = firebase.firestore();
    this.auth = firebase.auth();
  }

  // Authentication
  async signInWithEmail(email, password) {
    return this.auth.signInWithEmailAndPassword(email, password);
  }

  async signUpWithEmail(email, password) {
    return this.auth.createUserWithEmailAndPassword(email, password);
  }

  async signInWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    return this.auth.signInWithPopup(provider);
  }

  async signOut() {
    return this.auth.signOut();
  }

  onAuthStateChanged(callback) {
    return this.auth.onAuthStateChanged(callback);
  }

  // URL Operations
  async checkDuplicateUrl(longUrl, userId) {
    const snapshot = await this.db.collection('urls')
      .where('longUrl', '==', longUrl)
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      return snapshot.docs[0].id;
    }
    return null;
  }

  async createShortUrl(shortCode, longUrl, userId, userEmail) {
    await this.db.collection('urls').doc(shortCode).set({
      longUrl: longUrl,
      shortCode: shortCode,
      userId: userId,
      userEmail: userEmail,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      clicks: 0
    });
  }

  async getUrl(shortCode) {
    return this.db.collection('urls').doc(shortCode).get();
  }

  async incrementClicks(shortCode) {
    return this.db.collection('urls').doc(shortCode).update({
      clicks: firebase.firestore.FieldValue.increment(1),
      lastAccessed: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  // User Links
  subscribeToUserLinks(userId, callback, errorCallback) {
    return this.db.collection('urls')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(20)
      .onSnapshot(callback, errorCallback);
  }
}

/**
 * URLValidator - Handles URL validation and normalization
 */
class URLValidator {
  static isValidUrl(string) {
    string = string.trim();
    if (!string.match(/^https?:\/\//i)) {
      string = 'https://' + string;
    }
    
    try {
      const url = new URL(string);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
      return false;
    }
  }

  static normalizeUrl(string) {
    string = string.trim();
    if (!string.match(/^https?:\/\//i)) {
      return 'https://' + string;
    }
    return string;
  }
}

/**
 * ShortCodeGenerator - Generates unique short codes
 */
class ShortCodeGenerator {
  constructor(firebaseService) {
    this.firebaseService = firebaseService;
    this.chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  }

  generate() {
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += this.chars.charAt(Math.floor(Math.random() * this.chars.length));
    }
    return code;
  }

  async generateUnique() {
    let code;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      code = this.generate();
      attempts++;
      if (attempts > maxAttempts) {
        throw new Error('Unable to generate unique code. Please try again.');
      }
    } while (await this.codeExists(code));

    return code;
  }

  async codeExists(code) {
    const doc = await this.firebaseService.db.collection('urls').doc(code).get();
    return doc.exists;
  }
}

/**
 * UIStateManager - Manages UI state and transitions
 */
class UIStateManager {
  constructor(elements) {
    this.elements = elements;
  }

  reset() {
    this.elements.inputSection.style.display = 'none';
    this.elements.loadingState.style.display = 'none';
    this.elements.errorMessage.style.display = 'none';
    this.elements.resultSection.style.display = 'none';
  }

  showInput() {
    this.reset();
    this.elements.inputSection.style.display = 'flex';
    this.elements.urlInput.value = '';
  }

  showLoading() {
    this.reset();
    this.elements.loadingState.style.display = 'flex';
  }

  showResult(shortUrl) {
    this.reset();
    this.elements.resultSection.style.display = 'flex';
    this.elements.shortUrlLink.href = shortUrl;
    this.elements.shortUrlLink.textContent = shortUrl;
    return shortUrl;
  }

  showError(message) {
    this.elements.errorText.textContent = message;
    this.elements.errorMessage.style.display = 'flex';
    this.elements.errorMessage.style.animation = 'shake 0.5s ease, fadeIn 0.3s ease';
    
    setTimeout(() => {
      this.elements.errorMessage.style.opacity = '0';
      this.elements.errorMessage.style.transform = 'translateY(-10px)';
      setTimeout(() => {
        this.elements.errorMessage.style.display = 'none';
        this.elements.errorMessage.style.opacity = '1';
        this.elements.errorMessage.style.transform = 'translateY(0)';
      }, 300);
    }, 6000);
  }
}

/**
 * AuthComponent - Handles authentication UI and logic
 */
class AuthComponent {
  constructor(firebaseService, elements) {
    this.firebaseService = firebaseService;
    this.elements = elements;
    this.isLogin = true;
    this.currentUser = null;
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.monitorAuthState();
  }

  setupEventListeners() {
    this.elements.loginBtn.addEventListener('click', () => this.openAuthModal());
    this.elements.closeModal.addEventListener('click', () => this.closeAuthModal());
    this.elements.authModal.addEventListener('click', (e) => {
      if (e.target === this.elements.authModal) {
        this.closeAuthModal();
      }
    });

    // Auth tabs
    this.elements.authTabs.forEach(tab => {
      tab.addEventListener('click', () => this.handleTabChange(tab));
    });

    // Form submission
    this.elements.authForm.addEventListener('submit', (e) => this.handleFormSubmit(e));

    // Google sign-in
    this.elements.googleSignInBtn.addEventListener('click', () => this.handleGoogleSignIn());

    // Logout
    this.elements.logoutBtn.addEventListener('click', () => this.handleLogout());
  }

  monitorAuthState() {
    this.firebaseService.onAuthStateChanged((user) => {
      this.currentUser = user;
      this.updateUI(user);
    });
  }

  updateUI(user) {
    if (user) {
      this.elements.loginBtn.style.display = 'none';
      this.elements.userInfo.style.display = 'flex';
      this.elements.userName.textContent = user.displayName || user.email.split('@')[0];
      this.elements.userAvatar.src = user.photoURL || 
        `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || user.email)}&background=6366f1&color=fff`;
    } else {
      this.elements.loginBtn.style.display = 'block';
      this.elements.userInfo.style.display = 'none';
    }
  }

  openAuthModal() {
    this.elements.authModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  closeAuthModal() {
    this.elements.authModal.style.display = 'none';
    document.body.style.overflow = 'auto';
  }

  handleTabChange(tab) {
    this.elements.authTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    this.isLogin = tab.dataset.tab === 'login';
    this.elements.authSubmitBtn.querySelector('span').textContent = 
      this.isLogin ? 'Sign In' : 'Sign Up';
  }

  async handleFormSubmit(e) {
    e.preventDefault();
    const email = this.elements.authEmail.value.trim();
    const password = this.elements.authPassword.value;

    if (!email || !password) {
      alert('Please enter both email and password');
      return;
    }

    try {
      this.elements.authSubmitBtn.disabled = true;
      const spinnerHTML = '<div class="spinner" style="width: 20px; height: 20px; border-width: 2px;"></div>';
      this.elements.authSubmitBtn.innerHTML = spinnerHTML;

      if (this.isLogin) {
        await this.firebaseService.signInWithEmail(email, password);
      } else {
        await this.firebaseService.signUpWithEmail(email, password);
      }

      this.closeAuthModal();
      this.elements.authForm.reset();
    } catch (error) {
      this.handleAuthError(error);
    } finally {
      this.elements.authSubmitBtn.disabled = false;
      this.elements.authSubmitBtn.innerHTML = 
        `<span>${this.isLogin ? 'Sign In' : 'Sign Up'}</span><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    }
  }

  async handleGoogleSignIn() {
    try {
      this.elements.googleSignInBtn.disabled = true;
      this.elements.googleSignInBtn.innerHTML = 
        '<div class="spinner" style="width: 20px; height: 20px; border-width: 2px;"></div><span>Connecting...</span>';
      
      await this.firebaseService.signInWithGoogle();
      this.closeAuthModal();
    } catch (error) {
      this.handleAuthError(error);
    } finally {
      this.elements.googleSignInBtn.disabled = false;
      this.elements.googleSignInBtn.innerHTML = 
        `<svg width="20" height="20" viewBox="0 0 20 20">
          <path fill="#4285F4" d="M19.6 10.23c0-.82-.1-1.42-.25-2.05H10v3.72h5.5c-.15.96-.74 2.31-2.04 3.22v2.45h3.16c1.89-1.73 2.98-4.3 2.98-7.34z"/>
          <path fill="#34A853" d="M13.46 15.13c-.83.59-1.96 1-3.46 1-2.64 0-4.88-1.74-5.68-4.15H1.07v2.52C2.72 17.75 6.09 20 10 20c2.7 0 4.96-.89 6.62-2.42l-3.16-2.45z"/>
          <path fill="#FBBC05" d="M3.99 10c0-.69.12-1.35.32-1.97V5.51H1.07A9.973 9.973 0 000 10c0 1.61.39 3.14 1.07 4.49l3.24-2.52c-.2-.62-.32-1.28-.32-1.97z"/>
          <path fill="#EA4335" d="M10 3.88c1.88 0 3.13.81 3.85 1.48l2.84-2.76C14.96.99 12.7 0 10 0 6.09 0 2.72 2.25 1.07 5.51l3.24 2.52C5.12 5.62 7.36 3.88 10 3.88z"/>
        </svg><span>Continue with Google</span>`;
    }
  }

  async handleLogout() {
    await this.firebaseService.signOut();
  }

  handleAuthError(error) {
    let errorMsg = error.message;
    
    const errorMap = {
      'auth/user-not-found': '❌ No account found with this email',
      'auth/wrong-password': '❌ Incorrect password',
      'auth/email-already-in-use': '⚠️ Email already in use. Try logging in instead.',
      'auth/weak-password': '⚠️ Password should be at least 6 characters',
      'auth/invalid-email': '❌ Invalid email address',
      'auth/popup-closed-by-user': '⚠️ Sign-in cancelled. Please try again.',
      'auth/popup-blocked': '🚫 Pop-up blocked! Please allow pop-ups and try again.',
      'auth/network-request-failed': '🌐 Network error. Please check your connection.'
    };

    errorMsg = errorMap[error.code] || errorMsg;
    alert(errorMsg);
  }
}

/**
 * URLShortenComponent - Handles URL shortening logic
 */
class URLShortenComponent {
  constructor(firebaseService, uiStateManager, elements) {
    this.firebaseService = firebaseService;
    this.uiStateManager = uiStateManager;
    this.elements = elements;
    this.currentShortUrl = '';
    this.codeGenerator = new ShortCodeGenerator(firebaseService);
    this.authComponent = null;
    this.init();
  }

  init() {
    this.elements.shortenBtn.addEventListener('click', () => this.handleShorten());
    this.elements.urlInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.handleShorten();
    });
    this.elements.copyBtn.addEventListener('click', () => this.handleCopy());
    this.elements.createAnotherBtn.addEventListener('click', () => 
      this.uiStateManager.showInput());
  }

  setAuthComponent(authComponent) {
    this.authComponent = authComponent;
  }

  async handleShorten() {
    let longUrl = this.elements.urlInput.value.trim();

    if (!longUrl) {
      this.uiStateManager.showError('⚠️ Please enter a URL to shorten');
      this.elements.urlInput.focus();
      return;
    }

    if (!URLValidator.isValidUrl(longUrl)) {
      this.uiStateManager.showError('❌ Please enter a valid URL');
      this.elements.urlInput.focus();
      return;
    }

    longUrl = URLValidator.normalizeUrl(longUrl);

    if (!this.authComponent.currentUser) {
      this.uiStateManager.showError('🔐 Please sign in to shorten URLs');
      setTimeout(() => {
        this.authComponent.openAuthModal();
      }, 1000);
      return;
    }

    try {
      this.uiStateManager.showLoading();

      const existingCode = await this.firebaseService.checkDuplicateUrl(
        longUrl, 
        this.authComponent.currentUser.uid
      );
      
      if (existingCode) {
        const shortUrl = `${window.location.origin}/${existingCode}`;
        this.uiStateManager.showResult(shortUrl);
        this.uiStateManager.showError('✨ You already shortened this URL! Here it is again.');
        return;
      }

      const shortCode = await this.codeGenerator.generateUnique();

      await this.firebaseService.createShortUrl(
        shortCode,
        longUrl,
        this.authComponent.currentUser.uid,
        this.authComponent.currentUser.email
      );

      const shortUrl = `${window.location.origin}/${shortCode}`;
      this.currentShortUrl = shortUrl;
      this.uiStateManager.showResult(shortUrl);

    } catch (error) {
      console.error('Error creating short URL:', error);
      this.uiStateManager.showError('❌ ' + (error.message || 'Failed to create short link'));
      this.uiStateManager.showInput();
    }
  }

  handleCopy() {
    this.copyToClipboard(this.currentShortUrl);
    const originalText = this.elements.copyBtn.querySelector('.copy-text').textContent;
    this.elements.copyBtn.querySelector('.copy-text').textContent = 'Copied!';
    this.elements.copyBtn.classList.add('copied');
    
    setTimeout(() => {
      this.elements.copyBtn.querySelector('.copy-text').textContent = originalText;
      this.elements.copyBtn.classList.remove('copied');
    }, 2000);
  }

  copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      console.log('✅ Copied to clipboard');
    }).catch(err => {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
      } catch (err) {
        console.error('Copy failed:', err);
      }
      document.body.removeChild(textArea);
    });
  }
}

/**
 * UserLinksComponent - Displays user's shortened links
 */
class UserLinksComponent {
  constructor(firebaseService, elements) {
    this.firebaseService = firebaseService;
    this.elements = elements;
    this.unsubscribe = null;
  }

  subscribe(userId) {
    if (this.unsubscribe) {
      this.unsubscribe();
    }

    this.unsubscribe = this.firebaseService.subscribeToUserLinks(
      userId,
      (snapshot) => this.handleSnapshot(snapshot),
      (error) => this.handleError(error)
    );
  }

  unsubscribeFromUpdates() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  handleSnapshot(snapshot) {
    if (snapshot.empty) {
      this.elements.userLinksSection.style.display = 'none';
      this.elements.userLinksList.innerHTML = 
        '<div class="no-links-message">No shortened links yet. Create your first one above! 🚀</div>';
      return;
    }

    this.elements.userLinksSection.style.display = 'block';
    this.elements.userLinksList.innerHTML = '';

    snapshot.forEach((doc) => {
      const linkItem = this.createLinkItem(doc.data());
      this.elements.userLinksList.appendChild(linkItem);
    });
  }

  handleError(error) {
    console.error('Error loading links:', error);
    this.elements.userLinksSection.style.display = 'none';
  }

  createLinkItem(data) {
    const item = document.createElement('div');
    item.className = 'link-item';
    item.dataset.shortcode = data.shortCode;

    const shortUrl = `${window.location.origin}/${data.shortCode}`;
    const date = data.createdAt ? 
      new Date(data.createdAt.toDate()).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      }) : 'Just now';
    const clicks = data.clicks || 0;
    const displayLongUrl = data.longUrl.length > 60 ? 
      data.longUrl.substring(0, 60) + '...' : data.longUrl;

    item.innerHTML = `
      <div class="link-info">
        <div class="link-header">
          <a href="${shortUrl}" class="link-short" title="${shortUrl}">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="margin-right: 6px;">
              <path d="M8 3L3 8L8 13M13 3L8 8L13 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            ${data.shortCode}
          </a>
          <div class="link-stats">
            <span class="stat-item">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M8 3C4.5 3 1.5 8 1.5 8s3 5 6.5 5 6.5-5 6.5-5-3-5-6.5-5z" stroke="currentColor" stroke-width="1.5"/>
                <circle cx="8" cy="8" r="2" stroke="currentColor" stroke-width="1.5"/>
              </svg>
              <span class="clicks-count">${clicks}</span> ${clicks === 1 ? 'click' : 'clicks'}
            </span>
          </div>
        </div>
        <div class="link-target" title="${data.longUrl}">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style="margin-right: 6px; flex-shrink: 0;">
            <path d="M8 3H4C3.5 3 3 3.5 3 4v8c0 .5.5 1 1 1h8c.5 0 1-.5 1-1V8M10 3h3v3M7 9l6-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          <span>${displayLongUrl}</span>
        </div>
        <div class="link-meta">
          <span class="link-date">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style="margin-right: 4px;">
              <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/>
              <path d="M8 5v3l2 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            ${date}
          </span>
        </div>
      </div>
      <div class="link-actions">
        <button class="link-btn copy-link-btn" data-url="${shortUrl}" title="Copy short URL">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <rect x="5" y="5" width="9" height="9" rx="1" stroke="currentColor" stroke-width="1.5"/>
            <path d="M3 10H2.5C2.22386 10 2 9.77614 2 9.5V2.5C2 2.22386 2.22386 2 2.5 2H9.5C9.77614 2 10 2.22386 10 2.5V3" stroke="currentColor" stroke-width="1.5"/>
          </svg>
          Copy
        </button>
      </div>
    `;

    const copyBtn = item.querySelector('.copy-link-btn');
    copyBtn.addEventListener('click', () => this.handleCopyLink(copyBtn));

    return item;
  }

  handleCopyLink(btn) {
    navigator.clipboard.writeText(btn.dataset.url);
    const originalHTML = btn.innerHTML;
    btn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <path d="M3 8L6 11L13 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      Copied!
    `;
    btn.style.background = 'var(--success)';
    setTimeout(() => {
      btn.innerHTML = originalHTML;
      btn.style.background = '';
    }, 2000);
  }
}

/**
 * RedirectHandler - Handles short URL redirects
 */
class RedirectHandler {
  constructor(firebaseService) {
    this.firebaseService = firebaseService;
  }

  async handleRedirect() {
    const path = window.location.pathname;
    let shortCode = path.substring(1);
    
    if (shortCode.endsWith('.html')) {
      shortCode = shortCode.replace('.html', '');
    }

    if (!shortCode || shortCode === '' || shortCode === 'index') {
      return;
    }

    document.body.style.display = 'none';

    try {
      const doc = await this.firebaseService.getUrl(shortCode);

      if (doc.exists) {
        const data = doc.data();
        let targetUrl = data.longUrl;
        if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
          targetUrl = 'https://' + targetUrl;
        }
        
        this.firebaseService.incrementClicks(shortCode).catch(err => 
          console.log('Click count update failed:', err)
        );

        window.location.replace(targetUrl);
      } else {
        this.showErrorPage('Link Not Found', 'This short URL doesn\'t exist or may have been removed.');
      }
    } catch (error) {
      console.error('Error redirecting:', error);
      this.showErrorPage('Oops!', 'Something went wrong. Please try again.');
    }
  }

  showErrorPage(title, message) {
    document.body.style.display = 'block';
    document.body.innerHTML = `
      <style>
        .error-page {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #6366f1 0%, #06b6d4 100%);
          color: white;
          font-family: 'Inter', sans-serif;
          text-align: center;
          padding: 20px;
        }
        .error-icon { font-size: 64px; margin-bottom: 20px; }
        .error-title { font-size: 28px; font-weight: 800; margin-bottom: 10px; }
        .error-msg { font-size: 18px; margin-bottom: 30px; opacity: 0.9; }
        .home-btn {
          padding: 12px 32px;
          background: white;
          color: #6366f1;
          border: none;
          border-radius: 50px;
          font-weight: 700;
          font-size: 16px;
          cursor: pointer;
          text-decoration: none;
          display: inline-block;
        }
      </style>
      <div class="error-page">
        <div class="error-icon">${title === 'Link Not Found' ? '🔗' : '⚠️'}</div>
        <div class="error-title">${title}</div>
        <div class="error-msg">${message}</div>
        <a href="/" class="home-btn">Go to Home</a>
      </div>
    `;
  }
}

/**
 * ProfileComponent - Displays user profile, links, and analytics
 */
class ProfileComponent {
  constructor(firebaseService, elements) {
    this.firebase = firebaseService;
    this.elements = elements;
    this.profileModal = document.getElementById('profileModal');
    this.closeProfileBtn = document.getElementById('closeProfile');
    this.profileBtn = document.getElementById('profileBtn');
    this.currentUser = null;
    this.userLinks = [];
    this.unsubscribe = null;
    
    // Log for debugging
    console.log('ProfileComponent: profileBtn =', this.profileBtn);
    console.log('ProfileComponent: closeProfileBtn =', this.closeProfileBtn);
    console.log('ProfileComponent: profileModal =', this.profileModal);
  }

  setup() {
    if (!this.profileBtn) {
      console.error('❌ Profile button not found');
      return;
    }
    if (!this.closeProfileBtn) {
      console.error('❌ Close profile button not found');
      return;
    }
    if (!this.profileModal) {
      console.error('❌ Profile modal not found');
      return;
    }
    
    this.profileBtn.addEventListener('click', () => this.openProfile());
    this.closeProfileBtn.addEventListener('click', () => this.closeProfile());
    this.profileModal.addEventListener('click', (e) => {
      if (e.target === this.profileModal) this.closeProfile();
    });
    
    console.log('✅ ProfileComponent setup complete');
  }

  async openProfile() {
    if (!this.currentUser) {
      console.warn('⚠️ No user logged in');
      return;
    }
    if (!this.profileModal) {
      console.error('❌ Profile modal not available');
      return;
    }
    this.profileModal.style.display = 'flex';
    await this.loadProfileData();
    this.subscribeToLinks();
  }

  closeProfile() {
    if (!this.profileModal) {
      console.error('❌ Profile modal not available');
      return;
    }
    this.profileModal.style.display = 'none';
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }

  async loadProfileData() {
    try {
      // Update user info
      const email = this.currentUser.email;
      const createdAt = this.currentUser.metadata?.creationTime 
        ? new Date(this.currentUser.metadata.creationTime).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })
        : 'Recently';

      document.getElementById('profileUserEmail').textContent = email;
      document.getElementById('profileMemberSince').textContent = `Member since ${createdAt}`;
      document.getElementById('profileUserAvatar').src = this.currentUser.photoURL || this.getDefaultAvatar(email);
    } catch (error) {
      console.error('Error loading profile data:', error);
    }
  }

  subscribeToLinks() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }

    this.unsubscribe = this.firebase.subscribeToUserLinks(
      this.currentUser.uid,
      (snapshot) => {
        this.userLinks = [];
        snapshot.forEach(doc => {
          this.userLinks.push({
            id: doc.id,
            ...doc.data()
          });
        });
        this.updateProfileStats();
        this.renderLinksTable();
      },
      (error) => {
        console.error('Error fetching links:', error);
      }
    );
  }

  updateProfileStats() {
    const totalLinks = this.userLinks.length;
    const totalClicks = this.userLinks.reduce((sum, link) => sum + (link.clicks || 0), 0);
    const avgClicks = totalLinks > 0 ? Math.round(totalClicks / totalLinks) : 0;

    document.getElementById('totalLinks').textContent = totalLinks;
    document.getElementById('totalClicks').textContent = totalClicks;
    document.getElementById('avgClicks').textContent = avgClicks;
  }

  renderLinksTable() {
    const tableBody = document.getElementById('profileLinksBody');
    const noLinksMessage = document.getElementById('noLinksMessage');

    if (this.userLinks.length === 0) {
      tableBody.innerHTML = '';
      noLinksMessage.style.display = 'flex';
      return;
    }

    noLinksMessage.style.display = 'none';
    tableBody.innerHTML = this.userLinks.map((link, index) => {
      const createdDate = new Date(link.createdAt.seconds * 1000).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: '2-digit'
      });

      const displayUrl = this.getDisplayUrl(link.longUrl || link.originalUrl);

      return `
        <tr data-index="${index}">
          <td class="short-code-cell">${this.escapeHtml(link.shortCode)}</td>
          <td class="url-cell" title="${this.escapeHtml(link.longUrl || link.originalUrl)}">
            ${this.escapeHtml(displayUrl)}
          </td>
          <td class="clicks-cell">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style="opacity: 0.6;">
              <circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1"/>
              <path d="M7 4V7L9 8" stroke="currentColor" stroke-width="1" stroke-linecap="round"/>
            </svg>
            ${link.clicks || 0}
          </td>
          <td class="date-cell">${createdDate}</td>
          <td class="actions-cell">
            <button class="profile-action-btn copy-link-action" data-action="copy" data-index="${index}" title="Copy short URL">
              📋 Copy
            </button>
            <button class="profile-action-btn open-link" data-action="open" data-index="${index}" title="Open in new tab">
              ↗️ Open
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // Add event delegation for button clicks
    tableBody.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;

      const index = parseInt(btn.dataset.index);
      const link = this.userLinks[index];
      const shortUrl = `${window.location.origin}/${link.shortCode}`;

      if (btn.dataset.action === 'copy') {
        navigator.clipboard.writeText(shortUrl).then(() => {
          const originalText = btn.textContent;
          btn.textContent = '✓ Copied';
          setTimeout(() => {
            btn.textContent = originalText;
          }, 2000);
        }).catch(err => {
          console.error('Failed to copy:', err);
          alert('Failed to copy. Please try again.');
        });
      } else if (btn.dataset.action === 'open') {
        window.open(shortUrl, '_blank');
      }
    });
  }

  getDisplayUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname + (urlObj.pathname !== '/' ? urlObj.pathname : '');
    } catch {
      return url;
    }
  }

  getDefaultAvatar(email) {
    // Generate a gradient avatar based on email
    const colors = ['#6366f1', '#06b6d4', '#f59e0b', '#10b981', '#ef4444'];
    const index = email.charCodeAt(0) % colors.length;
    const color = colors[index];

    return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='${color.replace('#', '%23')}' width='100' height='100'/%3E%3Ctext x='50' y='50' font-size='45' fill='white' text-anchor='middle' dy='.3em' font-weight='bold'%3E${email.charAt(0).toUpperCase()}%3C/text%3E%3C/svg%3E`;
  }

  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  updateUser(user) {
    this.currentUser = user;
  }
}

/**
 * App - Main application class
 */
class App {
  constructor() {
    this.firebaseService = new FirebaseService();
    this.elements = this.cacheElements();
    this.uiStateManager = new UIStateManager(this.elements);
    this.authComponent = new AuthComponent(this.firebaseService, this.elements);
    this.urlShortenComponent = new URLShortenComponent(
      this.firebaseService, 
      this.uiStateManager, 
      this.elements
    );
    this.urlShortenComponent.setAuthComponent(this.authComponent);
    this.userLinksComponent = new UserLinksComponent(this.firebaseService, this.elements);
    this.profileComponent = new ProfileComponent(this.firebaseService, this.elements);
    this.setupAuthStateListener();
  }

  cacheElements() {
    return {
      // Auth elements
      loginBtn: document.getElementById('loginBtn'),
      logoutBtn: document.getElementById('logoutBtn'),
      userInfo: document.getElementById('userInfo'),
      userName: document.getElementById('userName'),
      userAvatar: document.getElementById('userAvatar'),
      authModal: document.getElementById('authModal'),
      closeModal: document.getElementById('closeModal'),
      authTabs: document.querySelectorAll('.auth-tab'),
      authForm: document.getElementById('authForm'),
      authEmail: document.getElementById('authEmail'),
      authPassword: document.getElementById('authPassword'),
      authSubmitBtn: document.getElementById('authSubmitBtn'),
      googleSignInBtn: document.getElementById('googleSignInBtn'),

      // URL shortening elements
      urlInput: document.getElementById('urlInput'),
      shortenBtn: document.getElementById('shortenBtn'),
      inputSection: document.getElementById('inputSection'),
      loadingState: document.getElementById('loadingState'),
      errorMessage: document.getElementById('errorMessage'),
      errorText: document.getElementById('errorText'),
      resultSection: document.getElementById('resultSection'),
      shortUrlLink: document.getElementById('shortUrlLink'),
      copyBtn: document.getElementById('copyBtn'),
      createAnotherBtn: document.getElementById('createAnotherBtn'),

      // User links elements
      userLinksSection: document.getElementById('userLinksSection'),
      userLinksList: document.getElementById('userLinksList')
    };
  }

  setupAuthStateListener() {
    this.firebaseService.onAuthStateChanged((user) => {
      if (user) {
        this.userLinksComponent.subscribe(user.uid);
        this.profileComponent.updateUser(user);
      } else {
        this.userLinksComponent.unsubscribeFromUpdates();
        this.profileComponent.updateUser(null);
        this.elements.userLinksSection.style.display = 'none';
      }
    });
  }

  init() {
    const currentPath = window.location.pathname;
    const isHomePage = currentPath === '/' || currentPath === '/index.html' || currentPath === '';

    if (!isHomePage) {
      console.log('🔄 Redirect mode detected');
      const redirectHandler = new RedirectHandler(this.firebaseService);
      redirectHandler.handleRedirect();
    } else {
      console.log('🏠 Home page mode');
      // Setup all components
      this.authComponent.init();
      this.urlShortenComponent.init();
      this.userLinksComponent.init();
      this.profileComponent.setup();
      this.uiStateManager.showInput();
      console.log('🚀 Modern URL Shortener initialized!');
    }
  }
}

// Initialize the application
const app = new App();
app.init();
