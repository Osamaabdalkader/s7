// navigation.js - نظام التنقل الكامل (مصحح)
class Navigation {
    static async showPage(pageId, params = {}) {
        console.log(`🔹 جاري تحميل الصفحة: ${pageId}`, params);
        
        document.getElementById('dynamic-content').innerHTML = `
            <div class="loading-page">
                <div class="loading-spinner"></div>
                <p>جاري تحميل الصفحة...</p>
            </div>
        `;
        
        try {
            await Utils.loadPageContent(pageId);
            await this.initializePage(pageId, params);
            console.log(`✅ تم تحميل الصفحة بنجاح: ${pageId}`);
        } catch (error) {
            console.error(`❌ فشل في تحميل الصفحة: ${pageId}`, error);
            this.showErrorPage(error, pageId);
        }
    }

    static async initializePage(pageId, params = {}) {
        console.log(`🔹 جاري تهيئة الصفحة: ${pageId}`, params);
        
        await new Promise(resolve => setTimeout(resolve, 100));
        
        switch (pageId) {
            case 'publish':
                this.handlePublishPage();
                break;
            case 'login':
                this.handleLoginPage();
                break;
            case 'register':
                this.handleRegisterPage();
                break;
            case 'profile':
                this.handleProfilePage();
                break;
            case 'home':
                Posts.loadPosts();
                Posts.initSearchAndFilter();
                break;
            case 'post-details':
                this.handlePostDetailsPage(params);
                break;
            case 'referral':
                await this.handleReferralPage();
                break;
        }
        
        this.rebindPageEvents(pageId);
    }

    static handlePublishPage() {
        const publishContent = document.getElementById('publish-content');
        const loginRequired = document.getElementById('login-required-publish');
        
        if (publishContent && loginRequired) {
            if (!currentUser) {
                publishContent.style.display = 'none';
                loginRequired.style.display = 'block';
            } else {
                publishContent.style.display = 'block';
                loginRequired.style.display = 'none';
            }
        }
    }

    static handleLoginPage() {
        const statusEl = document.getElementById('login-status');
        if (statusEl) {
            statusEl.style.display = 'none';
        }
    }

    static handleRegisterPage() {
        const statusEl = document.getElementById('register-status');
        if (statusEl) {
            statusEl.style.display = 'none';
        }
        
        const storedCode = ReferralSystem.getStoredReferralCode();
        if (storedCode) {
            const referralInput = document.getElementById('referral-code');
            if (referralInput) {
                referralInput.value = storedCode;
                Utils.showStatus(`تم تعبئة رمز الإحالة تلقائياً: ${storedCode}`, 'success', 'register-status');
            }
        }
    }

    static handleProfilePage() {
        const profileContent = document.getElementById('profile-content');
        const loginRequired = document.getElementById('login-required-profile');
        
        if (profileContent && loginRequired) {
            if (!currentUser) {
                profileContent.style.display = 'none';
                loginRequired.style.display = 'block';
            } else {
                profileContent.style.display = 'block';
                loginRequired.style.display = 'none';
                this.loadProfileData();
            }
        }
    }

    static handlePostDetailsPage(params) {
        if (params.postId) {
            PostDetails.loadPostDetails(params.postId);
        } else {
            PostDetails.showError();
        }
    }

    static async handleReferralPage() {
        if (!currentUser) {
            Utils.showStatus('يجب تسجيل الدخول لعرض صفحة الإحالة', 'error');
            Navigation.showPage('login');
            return;
        }

        try {
            Utils.showStatus('جاري تحميل إحصائيات الإحالة...', 'success');
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const stats = await ReferralSystem.getUserReferralStats(currentUser.id);
            this.displayReferralStats(stats);
            
            Utils.showStatus('تم تحميل البيانات بنجاح', 'success');
        } catch (error) {
            console.error('❌ Error loading referral stats:', error);
            Utils.showStatus(`خطأ في تحميل الإحصائيات: ${error.message}`, 'error');
            
            const container = document.querySelector('.referral-container');
            if (container) {
                const errorHtml = `
                    <div class="error-message" style="margin: 20px 0;">
                        <h3><i class="fas fa-exclamation-triangle"></i> خطأ في تحميل البيانات</h3>
                        <p>${error.message}</p>
                        <button onclick="Navigation.handleReferralPage()" class="btn-secondary" style="margin-top: 10px;">
                            <i class="fas fa-refresh"></i> إعادة المحاولة
                        </button>
                    </div>
                `;
                container.insertAdjacentHTML('beforeend', errorHtml);
            }
        }
    }

    static displayReferralStats(stats) {
        console.log('🔹 عرض إحصائيات الإحالة:', stats);
        
        const countEl = document.getElementById('referral-count');
        const codeEl = document.getElementById('referral-code');
        const linkInput = document.getElementById('referral-link-input');
        
        if (countEl) countEl.textContent = stats.referralCount;
        if (codeEl) codeEl.textContent = stats.code;
        if (linkInput) linkInput.value = ReferralSystem.getReferralLink(stats.code);

        this.displayReferralsList(stats.referrals);
    }

    static displayReferralsList(referrals) {
        const listEl = document.getElementById('referrals-list');
        if (!listEl) return;

        if (referrals.length === 0) {
            listEl.innerHTML = `
                <div class="no-referrals">
                    <i class="fas fa-users" style="font-size: 3rem; color: #ddd; margin-bottom: 15px;"></i>
                    <p>لا توجد إحالات حتى الآن</p>
                    <small>شارك رابط الإحالة الخاص بك مع أصدقائك لتبدأ في كسب الإحالات</small>
                </div>
            `;
            return;
        }

        listEl.innerHTML = referrals.map(ref => `
            <div class="referral-item">
                <div class="referral-user">
                    <i class="fas fa-user-check" style="color: var(--accent-color);"></i>
                    <span>${ref.referred.email}</span>
                </div>
                <div class="referral-date">
                    <i class="fas fa-calendar"></i>
                    ${new Date(ref.created_at).toLocaleString('ar-SA')}
                </div>
            </div>
        `).join('');
    }

    static loadProfileData() {
        if (currentUser) {
            const setName = (id, value) => {
                const el = document.getElementById(id);
                if (el) el.textContent = value;
            };
            
            setName('profile-name', currentUser.user_metadata.full_name || 'غير محدد');
            setName('profile-email', currentUser.email || 'غير محدد');
            setName('profile-phone', currentUser.user_metadata.phone || 'غير محدد');
            setName('profile-address', currentUser.user_metadata.address || 'غير محدد');
            setName('profile-created', new Date(currentUser.created_at).toLocaleString('ar-SA'));
        }
    }

    static updateNavigation() {
        const isLoggedIn = !!currentUser;
        
        // تحديث رأس الصفحة
        document.getElementById('publish-link').style.display = isLoggedIn ? 'list-item' : 'none';
        document.getElementById('profile-link').style.display = isLoggedIn ? 'list-item' : 'none';
        document.getElementById('referral-link').style.display = isLoggedIn ? 'list-item' : 'none';
        document.getElementById('logout-link').style.display = isLoggedIn ? 'list-item' : 'none';
        document.getElementById('login-link').style.display = isLoggedIn ? 'none' : 'list-item';
        document.getElementById('register-link').style.display = isLoggedIn ? 'none' : 'list-item';
        
        // تحديث الفوتر
        document.getElementById('footer-profile-link').style.display = isLoggedIn ? 'flex' : 'none';
        document.getElementById('footer-referral-link').style.display = isLoggedIn ? 'flex' : 'none';
        document.getElementById('footer-publish-link').style.display = isLoggedIn ? 'flex' : 'none';
    }

    static showErrorPage(error, pageId) {
        document.getElementById('dynamic-content').innerHTML = `
            <div class="error-page">
                <h1 class="section-title">خطأ في تحميل الصفحة</h1>
                <p>تعذر تحميل الصفحة المطلوبة: ${pageId}</p>
                <p>الخطأ: ${error.message}</p>
                <button onclick="Navigation.showPage('home')" class="btn-primary">
                    <i class="fas fa-home"></i> العودة إلى الرئيسية
                </button>
            </div>
        `;
    }

    static rebindPageEvents(pageId) {
        console.log(`🔹 إعادة ربط أحداث الصفحة: ${pageId}`);
    }
                          }
