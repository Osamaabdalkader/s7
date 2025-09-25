// js/referral.js - نظام الإحالة الكامل (معدل)
class ReferralSystem {
    static async generateReferralCode(userId) {
        try {
            // التأكد من أن userId موجود
            if (!userId) {
                throw new Error('معرف المستخدم مطلوب');
            }
            
            // إنشاء رمز إحالة فريد مكون من 8 أحرف
            let code;
            let isUnique = false;
            let attempts = 0;
            
            while (!isUnique && attempts < 10) {
                code = this.generateRandomCode(8);
                
                // التحقق من أن الرمز فريد
                const { data: existingCode, error: checkError } = await supabase
                    .from('referral_codes')
                    .select('code')
                    .eq('code', code)
                    .single();
                
                if (checkError && checkError.code === 'PGRST116') {
                    // الرمز فريد (لا يوجد سجل)
                    isUnique = true;
                } else if (!checkError && existingCode) {
                    // الرمز موجود، نجرب مرة أخرى
                    attempts++;
                    continue;
                } else {
                    throw checkError;
                }
            }
            
            if (!isUnique) {
                throw new Error('فشل في إنشاء رمز إحالة فريد');
            }
            
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
            
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error generating referral code:', error);
            throw error;
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
            const { data, error } = await supabase
                .from('referral_codes')
                .select('*')
                .eq('user_id', userId)
                .single();
            
            if (error && error.code !== 'PGRST116') throw error;
            
            // إذا لم يكن هناك رمز، ننشئ واحداً جديداً
            if (!data) {
                console.log('إنشاء رمز إحالة جديد للمستخدم:', userId);
                return await this.generateReferralCode(userId);
            }
            
            return data;
        } catch (error) {
            console.error('Error getting referral code:', error);
            throw error;
        }
    }

    static async validateReferralCode(code) {
        try {
            if (!code || code.trim() === '') {
                throw new Error('رمز الإحالة مطلوب');
            }
            
            const { data, error } = await supabase
                .from('referral_codes')
                .select('*, user:user_id(email, user_metadata)')
                .eq('code', code.toUpperCase().trim())
                .single();
            
            if (error) {
                if (error.code === 'PGRST116') {
                    throw new Error('رمز الإحالة غير صحيح');
                }
                throw error;
            }
            
            return data;
        } catch (error) {
            console.error('Error validating referral code:', error);
            throw error;
        }
    }

    static async processReferral(referralCode, referredUserId) {
        try {
            console.log('معالجة الإحالة:', { referralCode, referredUserId });
            
            // التحقق من صحة الرمز
            const referralData = await this.validateReferralCode(referralCode);
            
            // التأكد من أن المستخدم لا يحيل نفسه
            if (referralData.user_id === referredUserId) {
                throw new Error('لا يمكن استخدام رمز الإحالة الخاص بك');
            }
            
            // التحقق من عدم وجود إحالة سابقة لنفس المستخدم
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
            
            if (error) throw error;
            
            // زيادة عداد الإحالات
            await this.incrementReferralCount(referralData.user_id);
            
            console.log('تمت معالجة الإحالة بنجاح:', data);
            return true;
        } catch (error) {
            console.error('Error processing referral:', error);
            throw error;
        }
    }

    static async incrementReferralCount(userId) {
        try {
            const { error } = await supabase.rpc('increment_referral_count', {
                user_uuid: userId
            });
            
            if (error) throw error;
        } catch (error) {
            console.error('Error incrementing referral count:', error);
            throw error;
        }
    }

    static async getUserReferralStats(userId) {
        try {
            const referralCode = await this.getOrCreateReferralCode(userId);
            const referrals = await this.getUserReferrals(userId);
            
            return {
                code: referralCode?.code || 'غير متوفر',
                referralCount: referralCode?.referral_count || 0,
                referrals: referrals || []
            };
        } catch (error) {
            console.error('Error getting referral stats:', error);
            throw error;
        }
    }

    static async getUserReferrals(userId) {
        try {
            const { data, error } = await supabase
                .from('referrals')
                .select('*, referred:referred_id(email, user_metadata, created_at)')
                .eq('referrer_id', userId)
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error getting user referrals:', error);
            throw error;
        }
    }

    static getReferralLink(code) {
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
            console.error('Error copying referral link:', error);
            Utils.showStatus(`خطأ في نسخ الرابط: ${error.message}`, 'error');
            throw error;
        }
    }

    static checkUrlReferral() {
        const urlParams = new URLSearchParams(window.location.search);
        const refCode = urlParams.get('ref');
        
        if (refCode && refCode.trim() !== '') {
            // حفظ رمز الإحالة في localStorage لاستخدامه أثناء التسجيل
            localStorage.setItem('referral_code', refCode.trim());
            
            // إظهار إشعار للمستخدم إذا كان على صفحة التسجيل
            if (window.location.pathname.includes('register') || document.getElementById('register-page')) {
                Utils.showStatus(`تم اكتشاف رمز إحالة: ${refCode}`, 'success', 'register-status');
            }
            
            // إزالة المعلمة من URL بدون إعادة تحميل الصفحة
            const newUrl = window.location.pathname + window.location.hash;
            window.history.replaceState({}, document.title, newUrl);
            
            console.log('تم حفظ رمز الإحالة:', refCode);
        }
    }

    static getStoredReferralCode() {
        return localStorage.getItem('referral_code');
    }

    static clearStoredReferralCode() {
        localStorage.removeItem('referral_code');
    }

    static init() {
        // التحقق من وجود رمز إحالة في URL عند تحميل الصفحة
        this.checkUrlReferral();
        
        // إضافة event listener للروابط التي تحتوي على إحالات
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

// تهيئة نظام الإحالة عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    ReferralSystem.init();
});
