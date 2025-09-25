// js/app.js - الكود الرئيسي (مصحح نهائي)
class App {
    static async init() {
        console.log('=== تهيئة التطبيق ===');
        
        try {
            await this.testConnection();
            await Auth.checkAuth();
            Auth.initAuthListener();
            
            ReferralSystem.checkUrlReferral();
            
            Navigation.showPage('home');
            
            this.setupGlobalEventHandlers();
            
            console.log('✅ تم تهيئة التطبيق بنجاح');
        } catch (error) {
            console.error('❌ فشل في تهيئة التطبيق:', error);
            Utils.showStatus('فشل في تهيئة التطبيق', 'error', 'connection-status');
        }
    }

    static async testConnection() {
        try {
            const { data, error } = await supabase.from('marketing').select('count').limit(1);
            if (error) throw error;
            Utils.showStatus('✅ الاتصال مع قاعدة البيانات ناجح', 'success', 'connection-status');
        } catch (error) {
            Utils.showStatus(`❌ خطأ في الاتصال: ${error.message}`, 'error', 'connection-status');
        }
    }

    static setupGlobalEventHandlers() {
        document.addEventListener('click', (event) => {
            EventHandlers.handleGlobalClick(event);
        });

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

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
