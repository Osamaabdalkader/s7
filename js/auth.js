// auth.js - مصحح (بدون الاعتماد على profiles)
class Auth {
    static async login(email, password) {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password: password.trim()
            });

            if (error) {
                let errorMessage = 'فشل تسجيل الدخول';
                if (error.message.includes('Invalid login credentials')) {
                    errorMessage = 'البريد الإلكتروني أو كلمة المرور غير صحيحة';
                } else if (error.message.includes('Email not confirmed')) {
                    errorMessage = 'يرجى تأكيد البريد الإلكتروني أولاً';
                }
                throw new Error(errorMessage);
            }

            currentUser = data.user;
            this.onAuthStateChange();
            
            Utils.showStatus('تم تسجيل الدخول بنجاح!', 'success', 'login-status');
            
            setTimeout(() => {
                Navigation.showPage('home');
            }, 1000);

            return true;
        } catch (error) {
            console.error('❌ Error signing in:', error);
            throw error;
        }
    }

    static async register(userData) {
        try {
            console.log('🔹 بدء إنشاء حساب جديد...');
            
            // التحقق من البيانات الأساسية
            if (!userData.email || !userData.password) {
                throw new Error('البريد الإلكتروني وكلمة المرور مطلوبان');
            }

            // 1. إنشاء المستخدم في Supabase Auth
            const { data, error } = await supabase.auth.signUp({
                email: userData.email.trim(),
                password: userData.password.trim(),
                options: {
                    data: {
                        full_name: userData.name?.trim() || '',
                        phone: userData.phone?.trim() || '',
                        address: userData.address?.trim() || '',
                        referral_code_used: userData.referralCode || null
                    }
                }
            });

            if (error) {
                console.error('❌ خطأ في إنشاء المستخدم:', error);
                let errorMessage = 'فشل في إنشاء الحساب';
                
                if (error.message.includes('User already registered')) {
                    errorMessage = 'هذا البريد الإلكتروني مسجل مسبقاً';
                } else if (error.message.includes('Password should be at least')) {
                    errorMessage = 'كلمة المرور يجب أن تكون أقوى (6 أحرف على الأقل)';
                } else if (error.message.includes('Invalid email')) {
                    errorMessage = 'البريد الإلكتروني غير صحيح';
                } else if (error.message.includes('Unable to validate email address')) {
                    errorMessage = 'البريد الإلكتروني غير صالح';
                }
                
                throw new Error(errorMessage);
            }

            if (!data.user) {
                throw new Error('لم يتم إنشاء المستخدم بشكل صحيح');
            }

            console.log('✅ تم إنشاء المستخدم بنجاح:', data.user.id);

            // 2. انتظار بسيط لضمان اكتمال العملية
            await new Promise(resolve => setTimeout(resolve, 2000));

            // 3. إنشاء رمز إحالة للمستخدم الجديد
            try {
                console.log('🔹 جاري إنشاء رمز إحالة...');
                await ReferralSystem.getOrCreateReferralCode(data.user.id);
                console.log('✅ تم إنشاء رمز الإحالة بنجاح');
            } catch (referralError) {
                console.warn('⚠️ فشل في إنشاء رمز الإحالة:', referralError.message);
                // لا نوقف العملية
            }

            // 4. معالجة الإحالة إذا كان هناك رمز إحالة
            if (userData.referralCode && userData.referralCode.trim() !== '') {
                try {
                    console.log('🔹 معالجة الإحالة...');
                    await ReferralSystem.processReferral(userData.referralCode, data.user.id);
                    console.log('✅ تمت معالجة الإحالة بنجاح');
                } catch (referralError) {
                    console.warn('⚠️ فشل في معالجة الإحالة:', referralError.message);
                    // لا نوقف العملية
                }
            }

            // 5. تنظيف البيانات
            const form = document.getElementById('register-form');
            if (form) form.reset();
            
            ReferralSystem.clearStoredReferralCode();

            // 6. إظهار رسالة النجاح
            Utils.showStatus('✅ تم إنشاء الحساب بنجاح! يرجى تسجيل الدخول', 'success', 'register-status');
            
            setTimeout(() => {
                Navigation.showPage('login');
            }, 3000);

            return true;
        } catch (error) {
            console.error('❌ Error signing up:', error);
            Utils.showStatus(`❌ فشل في إنشاء الحساب: ${error.message}`, 'error', 'register-status');
            throw error;
        }
    }

    static async logout() {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) throw error;
            
            currentUser = null;
            this.onAuthStateChange();
            Navigation.showPage('home');
        } catch (error) {
            console.error('❌ Error signing out:', error.message);
        }
    }

    static async checkAuth() {
        try {
            const { data: { session }, error } = await supabase.auth.getSession();
            if (error) throw error;
            
            if (session?.user) {
                currentUser = session.user;
                this.onAuthStateChange();
            }
        } catch (error) {
            console.error('❌ Error checking auth:', error.message);
        }
    }

    static onAuthStateChange() {
        Navigation.updateNavigation();
    }

    static initAuthListener() {
        supabase.auth.onAuthStateChange((event, session) => {
            console.log('🔹 Auth state changed:', event);
            
            if (event === 'SIGNED_IN' && session?.user) {
                currentUser = session.user;
                this.onAuthStateChange();
            } else if (event === 'SIGNED_OUT') {
                currentUser = null;
                this.onAuthStateChange();
            }
        });
    }
        }
