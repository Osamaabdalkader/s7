// auth.js - نظام المصادقة الكامل (مصحح)
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
            
            // إنشاء رمز إحالة بعد تسجيل الدخول بنجاح
            setTimeout(async () => {
                try {
                    await ReferralSystem.getOrCreateReferralCode(currentUser.id);
                    console.log('✅ تم إنشاء/جلب رمز الإحالة بعد تسجيل الدخول');
                } catch (error) {
                    console.warn('⚠️ لم يتم إنشاء رمز إحالة بعد التسجيل:', error.message);
                }
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
            console.log('🔹 === بدء عملية التسجيل ===');
            console.log('بيانات المستخدم:', {
                email: userData.email,
                name: userData.name,
                hasReferralCode: !!userData.referralCode
            });

            // 1. إنشاء المستخدم في Supabase Auth
            const { data, error } = await supabase.auth.signUp({
                email: userData.email.trim(),
                password: userData.password.trim(),
                options: {
                    data: {
                        full_name: userData.name.trim(),
                        phone: userData.phone.trim(),
                        address: userData.address.trim(),
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
                }
                throw new Error(errorMessage);
            }

            if (!data.user) {
                throw new Error('لم يتم إنشاء المستخدم بشكل صحيح');
            }

            console.log('✅ تم إنشاء المستخدم بنجاح:', data.user.id);

            // 2. انتظار قصير لضمان اكتمال إنشاء المستخدم
            await new Promise(resolve => setTimeout(resolve, 1000));

            // 3. إنشاء رمز إحالة للمستخدم الجديد
            try {
                console.log('🔹 جاري إنشاء رمز إحالة للمستخدم الجديد...');
                const referralCode = await ReferralSystem.getOrCreateReferralCode(data.user.id);
                console.log('✅ تم إنشاء رمز الإحالة بنجاح:', referralCode.code);
            } catch (referralError) {
                console.error('❌ فشل في إنشاء رمز الإحالة:', referralError);
                // لا نوقف العملية إذا فشل إنشاء رمز الإحالة
            }

            // 4. معالجة الإحالة إذا كان هناك رمز إحالة
            if (userData.referralCode && userData.referralCode.trim() !== '') {
                try {
                    console.log('🔹 جاري معالجة الإحالة بالرمز:', userData.referralCode);
                    await ReferralSystem.processReferral(userData.referralCode, data.user.id);
                    console.log('✅ تمت معالجة الإحالة بنجاح');
                } catch (referralError) {
                    console.warn('⚠️ فشل في معالجة الإحالة:', referralError.message);
                    // لا نوقف عملية التسجيل إذا فشلت الإحالة
                }
            }

            // 5. تنظيف البيانات
            const form = document.getElementById('register-form');
            if (form) form.reset();
            
            ReferralSystem.clearStoredReferralCode();

            // 6. إظهار رسالة النجاح
            Utils.showStatus('تم إنشاء الحساب بنجاح! يرجى تسجيل الدخول', 'success', 'register-status');
            
            setTimeout(() => {
                Navigation.showPage('login');
            }, 2000);

            return true;
        } catch (error) {
            console.error('❌ Error signing up:', error);
            Utils.showStatus(`فشل في إنشاء الحساب: ${error.message}`, 'error', 'register-status');
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
            alert(`خطأ في تسجيل الخروج: ${error.message}`);
        }
    }

    static async checkAuth() {
        try {
            const { data: { session }, error } = await supabase.auth.getSession();
            if (error) throw error;
            
            if (session?.user) {
                currentUser = session.user;
                this.onAuthStateChange();
                
                // التأكد من وجود رمز إحالة للمستخدم المسجل الدخول
                try {
                    await ReferralSystem.getOrCreateReferralCode(currentUser.id);
                } catch (error) {
                    console.warn('⚠️ فشل في إنشاء رمز إحالة للمستخدم المسجل:', error);
                }
            }
        } catch (error) {
            console.error('❌ Error checking auth:', error.message);
        }
    }

    static onAuthStateChange() {
        Navigation.updateNavigation();
        
        if (currentUser) {
            Utils.showStatus('تم تسجيل الدخول بنجاح', 'success', 'connection-status');
        }
    }

    static initAuthListener() {
        supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('🔹 Auth state changed:', event);
            
            if (event === 'SIGNED_IN' && session?.user) {
                currentUser = session.user;
                this.onAuthStateChange();
                
                // التأكد من وجود رمز إحالة بعد تسجيل الدخول
                try {
                    await ReferralSystem.getOrCreateReferralCode(currentUser.id);
                } catch (error) {
                    console.warn('⚠️ فشل في إنشاء رمز إحالة بعد التسجيل:', error);
                }
            } else if (event === 'SIGNED_OUT') {
                currentUser = null;
                this.onAuthStateChange();
            }
        });
    }
                    }
