// js/referral.js - نظام الإحالة الكامل (مصحح العلاقات)
class ReferralSystem {
    static async generateReferralCode(userId) {
        try {
            console.log('🔹 بدء إنشاء رمز إحالة للمستخدم:', userId);
            
            if (!userId) {
                throw new Error('معرف المستخدم مطلوب لإنشاء رمز إحالة');
            }
            
            // إنشاء رمز فريد
            let code;
            let isUnique = false;
            let attempts = 0;
            const maxAttempts = 10;
            
            while (!isUnique && attempts < maxAttempts) {
                code = this.generateRandomCode(8);
                console.log('🔹 المحاولة', attempts + 1, 'الرمز المولد:', code);
                
                // التحقق من التكرار باستخدام استعلام مباشر
                const { data: existingCode, error: checkError } = await supabase
                    .from('referral_codes')
                    .select('id')
                    .eq('code', code)
                    .single();
                
                if (checkError && checkError.code === 'PGRST116') {
                    // لا يوجد رمز - فريد
                    isUnique = true;
                } else if (!checkError && existingCode) {
                    // الرمز موجود - نجرب مرة أخرى
                    attempts++;
                    continue;
                } else if (checkError) {
                    throw checkError;
                } else {
                    isUnique = true;
                }
            }
            
            if (!isUnique) {
                throw new Error('فشل في إنشاء رمز إحالة فريد بعد ' + maxAttempts + ' محاولات');
            }
            
            console.log('✅ رمز فريد تم إنشاؤه:', code);
            
            // إدخال الرمز في قاعدة البيانات
            const { data, error } = await supabase
                .from('referral_codes')
                .insert([
                    { 
                        user_id: userId,
                        code: code,
                        referral_count: 0
                    }
                ])
                .select()
                .single();
            
            if (error) {
                console.error('❌ خطأ في إدخال الرمز:', error);
                throw error;
            }
            
            console.log('✅ تم إنشاء رمز الإحالة بنجاح:', data);
            return data;
        } catch (error) {
            console.error('❌ Error generating referral code:', error);
            throw new Error('فشل في إنشاء رمز الإحالة: ' + error.message);
        }
    }

    static generateRandomCode(length) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    static async getOrCreateReferralCode(userId) {
        try {
            console.log('🔹 جلب أو إنشاء رمز إحالة للمستخدم:', userId);
            
            if (!userId) {
                throw new Error('معرف المستخدم مطلوب');
            }
            
            // محاولة جلب الرمز الموجود
            const { data, error } = await supabase
                .from('referral_codes')
                .select('*')
                .eq('user_id', userId)
                .single();
            
            if (error && error.code === 'PGRST116') {
                // لا يوجد رمز - ننشئ واحداً جديداً
                console.log('🔹 لا يوجد رمز، جاري إنشاء رمز جديد...');
                return await this.generateReferralCode(userId);
            } else if (error) {
                console.error('❌ خطأ في جلب الرمز:', error);
                throw error;
            }
            
            console.log('✅ تم العثور على رمز موجود:', data.code);
            return data;
        } catch (error) {
            console.error('❌ Error in getOrCreateReferralCode:', error);
            throw error;
        }
    }

    static async validateReferralCode(code) {
        try {
            if (!code || code.trim() === '') {
                throw new Error('رمز الإحالة مطلوب');
            }
            
            const cleanCode = code.toUpperCase().trim();
            console.log('🔹 التحقق من صحة الرمز:', cleanCode);
            
            // استعلام مباشر بدون علاقات معقدة
            const { data, error } = await supabase
                .from('referral_codes')
                .select('*')
                .eq('code', cleanCode)
                .single();
            
            if (error) {
                if (error.code === 'PGRST116') {
                    throw new Error('رمز الإحالة غير صحيح');
                }
                console.error('❌ خطأ في التحقق من الرمز:', error);
                throw error;
            }
            
            if (!data) {
                throw new Error('رمز الإحالة غير صحيح');
            }
            
            console.log('✅ الرمز صحيح، يعود للمستخدم:', data.user_id);
            return data;
        } catch (error) {
            console.error('❌ Error validating referral code:', error);
            throw error;
        }
    }

    static async processReferral(referralCode, referredUserId) {
        try {
            console.log('🔹 بدء معالجة الإحالة:', { 
                referralCode: referralCode, 
                referredUserId: referredUserId 
            });
            
            if (!referralCode || !referredUserId) {
                throw new Error('بيانات الإحالة غير مكتملة');
            }
            
            // التحقق من صحة الرمز
            const referralData = await this.validateReferralCode(referralCode);
            
            // التأكد من أن المستخدم لا يحيل نفسه
            if (referralData.user_id === referredUserId) {
                throw new Error('لا يمكن استخدام رمز الإحالة الخاص بك');
            }
            
            // التحقق من عدم وجود إحالة سابقة
            const { data: existingReferral, error: checkError } = await supabase
                .from('referrals')
                .select('id')
                .eq('referred_id', referredUserId)
                .single();
            
            if (existingReferral) {
                throw new Error('تم تسجيل إحالة لهذا المستخدم مسبقاً');
            }
            
            if (checkError && checkError.code !== 'PGRST116') {
                throw checkError;
            }
            
            // تسجيل الإحالة
            const { data, error } = await supabase
                .from('referrals')
                .insert([
                    {
                        referrer_id: referralData.user_id,
                        referred_id: referredUserId,
                        referral_code: referralData.code
                    }
                ])
                .select();
            
            if (error) {
                console.error('❌ خطأ في تسجيل الإحالة:', error);
                throw error;
            }
            
            // زيادة عداد الإحالات
            await this.incrementReferralCount(referralData.user_id);
            
            console.log('✅ تمت معالجة الإحالة بنجاح');
            return true;
        } catch (error) {
            console.error('❌ Error processing referral:', error);
            throw new Error('فشل في معالجة الإحالة: ' + error.message);
        }
    }

    static async incrementReferralCount(userId) {
        try {
            console.log('🔹 زيادة عداد الإحالات للمستخدم:', userId);
            
            const { error } = await supabase.rpc('increment_referral_count', {
                user_uuid: userId
            });
            
            if (error) {
                console.error('❌ خطأ في زيادة العداد:', error);
                throw error;
            }
            
            console.log('✅ تم زيادة العداد بنجاح');
        } catch (error) {
            console.error('❌ Error incrementing referral count:', error);
            throw error;
        }
    }

    static async getUserReferralStats(userId) {
        try {
            console.log('🔹 جلب إحصائيات الإحالة للمستخدم:', userId);
            
            if (!userId) {
                throw new Error('معرف المستخدم مطلوب');
            }
            
            const referralCode = await this.getOrCreateReferralCode(userId);
            const referrals = await this.getUserReferrals(userId);
            
            const stats = {
                code: referralCode?.code || 'غير متوفر',
                referralCount: referralCode?.referral_count || 0,
                referrals: referrals || []
            };
            
            console.log('✅ الإحصائيات المستلمة:', stats);
            return stats;
        } catch (error) {
            console.error('❌ Error getting referral stats:', error);
            throw new Error('فشل في جلب إحصائيات الإحالة: ' + error.message);
        }
    }

    static async getUserReferrals(userId) {
        try {
            // استعلام بسيط بدون علاقات معقدة
            const { data, error } = await supabase
                .from('referrals')
                .select('referred_id, created_at, referral_code')
                .eq('referrer_id', userId)
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            
            // جلب معلومات المستخدمين المشير إليهم بشكل منفصل
            const referralsWithUsers = await Promise.all(
                (data || []).map(async (ref) => {
                    try {
                        // جلب البريد الإلكتروني للمستخدم المشير إليه
                        const { data: userData, error: userError } = await supabase
                            .from('profiles') // إذا كان لديك جدول profiles
                            .select('email')
                            .eq('id', ref.referred_id)
                            .single();
                        
                        if (userError) {
                            // إذا لم يكن هناك جدول profiles، نستخدم auth.users (يتطلب صلاحيات خاصة)
                            console.warn('لا يمكن جلب بيانات المستخدم:', userError);
                            return {
                                ...ref,
                                referred: { email: 'مستخدم غير معروف' }
                            };
                        }
                        
                        return {
                            ...ref,
                            referred: { email: userData?.email || 'مستخدم غير معروف' }
                        };
                    } catch (error) {
                        console.error('Error fetching user data:', error);
                        return {
                            ...ref,
                            referred: { email: 'مستخدم غير معروف' }
                        };
                    }
                })
            );
            
            return referralsWithUsers;
        } catch (error) {
            console.error('❌ Error getting user referrals:', error);
            return [];
        }
    }

    static getReferralLink(code) {
        if (!code) return 'غير متوفر';
        return `${window.location.origin}${window.location.pathname}?ref=${code}`;
    }

    static async copyReferralLinkToClipboard() {
        try {
            if (!currentUser) {
                throw new Error('يجب تسجيل الدخول أولاً');
            }
            
            const stats = await this.getUserReferralStats(currentUser.id);
            const link = this.getReferralLink(stats.code);
            
            await navigator.clipboard.writeText(link);
            Utils.showStatus('تم نسخ رابط الإحالة إلى الحافظة', 'success');
            return link;
        } catch (error) {
            console.error('❌ Error copying referral link:', error);
            Utils.showStatus(`خطأ في نسخ الرابط: ${error.message}`, 'error');
            throw error;
        }
    }

    static checkUrlReferral() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const refCode = urlParams.get('ref');
            
            if (refCode && refCode.trim() !== '') {
                const cleanCode = refCode.trim().toUpperCase();
                localStorage.setItem('referral_code', cleanCode);
                
                console.log('✅ تم حفظ رمز الإحالة من URL:', cleanCode);
                
                // إزالة المعلمة من URL
                const newUrl = window.location.pathname;
                window.history.replaceState({}, document.title, newUrl);
                
                return cleanCode;
            }
        } catch (error) {
            console.error('❌ Error checking URL referral:', error);
        }
        return null;
    }

    static getStoredReferralCode() {
        return localStorage.getItem('referral_code');
    }

    static clearStoredReferralCode() {
        localStorage.removeItem('referral_code');
    }

    static init() {
        this.checkUrlReferral();
        
        document.addEventListener('click', (event) => {
            const link = event.target.closest('a[href*="ref="]');
            if (link) {
                event.preventDefault();
                const url = new URL(link.href);
                const refCode = url.searchParams.get('ref');
                if (refCode) {
                    localStorage.setItem('referral_code', refCode);
                    Navigation.showPage('register');
                }
            }
        });
    }
}

// التهيئة التلقائية
document.addEventListener('DOMContentLoaded', () => {
    ReferralSystem.init();
});
