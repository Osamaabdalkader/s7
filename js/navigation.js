// navigation.js - معدل (مع نظام الإحالة وإصلاح التحميل)
class Navigation {
    static async showPage(pageId, params = {}) {
        console.log(`جاري تحميل الصفحة: ${pageId}`, params);
        
        // إظهار رسالة تحميل
        document.getElementById('dynamic-content').innerHTML = `
            <div class="loading-page">
                <div class="loading-spinner"></div>
                <p>جاري تحميل الصفحة...</p>
            </div>
        `;
        
        try {
            await Utils.loadPageContent(pageId);
            await this.initializePage(pageId, params);
            console.log(`تم تحميل الصفحة بنجاح: ${pageId}`);
        } catch (error) {
            console.error(`فشل في تحميل الصفحة: ${pageId}`, error);
            this.showErrorPage(error, pageId);
        }
    }

    static async initializePage(pageId, params = {}) {
        console.log(`جاري تهيئة الصفحة: ${pageId}`, params);
        
        // إعطاء وقت للعناصر لتصبح جاهزة في DOM
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
        
        // إعادة ربط الأحداث بعد تهيئة الصفحة
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
        
        // التحقق من وجود رمز إحالة مخزن وعرضه
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
            Navigation.showPage('login');
            return;
        }

        try {
            // إعطاء وقت لتحميل بيانات المستخدم
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const stats = await ReferralSystem.getUserReferralStats(currentUser.id);
            this.displayReferralStats(stats);
        } catch (error) {
            console.error('Error loading referral stats:', error);
            Utils.showStatus('خطأ في تحميل إحصائيات الإحالة', 'error');
            
            // عرض رسالة خطأ مفصلة
            const container = document.querySelector('.referral-container');
            if (container) {
                container.innerHTML += `
                    <div class="error-message">
                        <h3>خطأ في تحميل البيانات</h3>
                        <p>${error.message}</p>
                        <button onclick="Navigation.showPage('referral')" class="btn-secondary">
                            <i class="fas fa-refresh"></i> إعادة المحاولة
                        </button>
                    </div>
                `;
            }
        }
    }

    static displayReferralStats(stats) {
        // تحديث الإحصائيات
        const countEl = document.getElementById('referral-count');
        const codeEl = document.getElementById('referral-code');
        const linkInput = document.getElementById('referral-link-input');
        
        if (countEl) countEl.textContent = stats.referralCount;
        if (codeEl) codeEl.textContent = stats.code;
        if (linkInput) linkInput.value = ReferralSystem.getReferralLink(stats.code);

        // عرض قائمة الإحالات
        this.displayReferralsList(stats.referrals);
    }

    static displayReferralsList(referrals) {
        const listEl = document.getElementById('referrals-list');
        if (!listEl) return;

        if (referrals.length === 0) {
            listEl.innerHTML = '<p class="no-referrals">لا توجد إحالات حتى الآن</p>';
            return;
        }

        listEl.innerHTML = referrals.map(ref => `
            <div class="referral-item">
                <div class="referral-user">
                    <i class="fas fa-user"></i>
                    <span>${ref.referred.email}</span>
                </div>
                <div class="referral-date">
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
        const headerElements = {
            'publish-link': currentUser,
            'profile-link': currentUser,
            'referral-link': currentUser,
            'logout-link': currentUser,
            'login-link': !currentUser,
            'register-link': !currentUser
        };

        for (const [id, shouldShow] of Object.entries(headerElements)) {
            const element = document.getElementById(id);
            if (element) {
                element.style.display = shouldShow ? 'list-item' : 'none';
            }
        }

        const footerProfile = document.getElementById('footer-profile-link');
        const footerReferral = document.getElementById('footer-referral-link');
        const footerPublish = document.getElementById('footer-publish-link');
        
        if (footerProfile) {
            footerProfile.style.display = currentUser ? 'flex' : 'none';
        }
        if (footerReferral) {
            footerReferral.style.display = currentUser ? 'flex' : 'none';
        }
        if (footerPublish) {
            footerPublish.style.display = currentUser ? 'flex' : 'none';
        }
    }

    static showErrorPage(error, pageId) {
        document.getElementById('dynamic-content').innerHTML = `
            <div class="error-page">
                <h1 class="section-title">خطأ في تحميل الصفحة</h1>
                <p>تعذر تحميل الصفحة المطلوبة: ${pageId}</p>
                <p>الخطأ: ${error.message}</p>
                <button onclick="Navigation.showPage('home')">العودة إلى الرئيسية</button>
            </div>
        `;
    }

    static rebindPageEvents(pageId) {
        console.log(`إعادة ربط أحداث الصفحة: ${pageId}`);
    }
    }
