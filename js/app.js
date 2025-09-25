// js/app.js - الكود الرئيسي (مع نظام الإحالة)
class App {
    static async init() {
        console.log('تهيئة التطبيق...');
        
        await this.testConnection();
        await Auth.checkAuth();
        Auth.initAuthListener();
        
        // التحقق من وجود رمز إحالة في URL
        ReferralSystem.checkUrlReferral();
        
        Navigation.showPage('home');
        
        // إعداد معالجة الأحداث العالمية
        this.setupGlobalEventHandlers();
        
        console.log('تم تهيئة التطبيق بنجاح');
    }

    static async testConnection() {
        try {
            const { data, error } = await supabase.from('marketing').select('count');
            if (error) throw error;
            Utils.showStatus('الاتصال مع قاعدة البيانات ناجح', 'success', 'connection-status');
        } catch (error) {
            Utils.showStatus(`خطأ في الاتصال: ${error.message}`, 'error', 'connection-status');
        }
    }

    // إعداد معالجات الأحداث العالمية
    static setupGlobalEventHandlers() {
        // معالجة النقر على المحتوى الديناميكي
        document.addEventListener('click', (event) => {
            EventHandlers.handleGlobalClick(event);
        });

        // معالجة تقديم النماذج
        document.addEventListener('submit', (event) => {
            EventHandlers.handleGlobalSubmit(event);
        });
    }

    static toggleDebug() {
        debugMode = !debugMode;
        const debugInfo = document.getElementById('debug-info');
        if (debugInfo) {
            debugInfo.style.display = debugMode ? 'block' : 'none';
            if (debugMode) Utils.loadDebugInfo();
        }
    }
}

// تهيئة التطبيق عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});