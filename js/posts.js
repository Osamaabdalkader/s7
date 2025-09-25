// posts.js - إضافة وظيفة النشر (معدل)
class Posts {
    static currentFilters = {
        search: '',
        category: '',
        location: ''
    };

    static allPosts = [];
    static uniqueLocations = [];

    static async loadPosts(filters = {}) {
        try {
            // دمج الفلاتر الحالية مع الجديدة
            this.currentFilters = { ...this.currentFilters, ...filters };
            
            let query = supabase
                .from('marketing')
                .select('*')
                .order('created_at', { ascending: false });
            
            const { data: posts, error } = await query;
            
            if (error) throw error;
            
            this.allPosts = posts || [];
            this.extractUniqueLocations();
            this.applyFilters();
        } catch (error) {
            console.error('Error loading posts:', error);
            Utils.showStatus(`خطأ في تحميل المنشورات: ${error.message}`, 'error', 'connection-status');
        }
    }

    static extractUniqueLocations() {
        // استخراج المواقع الفريدة من جميع المنشورات
        const locations = [...new Set(this.allPosts.map(post => post.location).filter(Boolean))];
        this.uniqueLocations = locations.sort();
        
        // تحديث قائمة المواقع في الفلتر
        this.updateLocationFilter();
    }

    static updateLocationFilter() {
        const locationFilter = document.getElementById('location-filter');
        if (!locationFilter) return;

        // حفظ القيمة الحالية
        const currentValue = locationFilter.value;
        
        // مسح الخيارات الحالية (عدا الخيار الافتراضي)
        locationFilter.innerHTML = '<option value="">جميع المواقع</option>';
        
        // إضافة المواقع الفريدة
        this.uniqueLocations.forEach(location => {
            const option = document.createElement('option');
            option.value = location;
            option.textContent = location;
            locationFilter.appendChild(option);
        });
        
        // استعادة القيمة السابقة إذا كانت لا تزال موجودة
        if (currentValue && this.uniqueLocations.includes(currentValue)) {
            locationFilter.value = currentValue;
        }
    }

    static applyFilters() {
        let filteredPosts = [...this.allPosts];

        // تطبيق فلتر البحث (بالاسم والوصف)
        if (this.currentFilters.search) {
            const searchTerm = this.currentFilters.search.toLowerCase();
            filteredPosts = filteredPosts.filter(post => 
                post.name.toLowerCase().includes(searchTerm) ||
                post.description.toLowerCase().includes(searchTerm)
            );
        }

        // تطبيق فلتر النوع
        if (this.currentFilters.category) {
            filteredPosts = filteredPosts.filter(post => 
                post.category === this.currentFilters.category
            );
        }

        // تطبيق فلتر الموقع
        if (this.currentFilters.location) {
            filteredPosts = filteredPosts.filter(post => 
                post.location === this.currentFilters.location
            );
        }

        this.displayFilteredPosts(filteredPosts);
    }

    static displayFilteredPosts(posts) {
        const postsContainer = document.getElementById('posts-container');
        const noResults = document.getElementById('no-results');
        
        if (!postsContainer || !noResults) return;
        
        postsContainer.innerHTML = '';
        
        if (!posts || posts.length === 0) {
            postsContainer.style.display = 'none';
            noResults.style.display = 'block';
            return;
        }
        
        postsContainer.style.display = 'grid';
        noResults.style.display = 'none';
        
        posts.forEach(post => {
            const postElement = document.createElement('div');
            postElement.className = 'post-card';
            postElement.style.cursor = 'pointer';
            
            const imageHtml = post.image_url 
                ? `<img src="${post.image_url}" alt="${post.name}" class="post-image">`
                : `<div class="post-image no-image">لا توجد صورة</div>`;
            
            postElement.innerHTML = `
                ${imageHtml}
                <h3 class="post-title">${post.name}</h3>
                <p class="post-description">${post.description}</p>
                <div class="post-details">
                    <span class="post-detail post-price"><i class="fas fa-money-bill-wave"></i> ${Utils.formatPrice(post.price)}</span>
                    <span class="post-detail"><i class="fas fa-tag"></i> ${post.category}</span>
                    <span class="post-detail"><i class="fas fa-map-marker-alt"></i> ${post.location}</span>
                </div>
                <div class="post-author">
                    <i class="fas fa-user"></i> 
                    ${post.user_id ? `تم النشر بواسطة: ${post.user_id}` : 'مستخدم غير معروف'}
                </div>
                <small>${new Date(post.created_at).toLocaleString('ar-SA')}</small>
            `;
            
            postElement.addEventListener('click', () => {
                Navigation.showPage('post-details', { postId: post.id });
            });
            
            postsContainer.appendChild(postElement);
        });
    }

    static async publishPost(postData) {
        try {
            let imageUrl = null;
            
            if (postData.imageFile && postData.imageFile.size > 0) {
                imageUrl = await this.uploadImage(postData.imageFile);
            }

            const { data, error } = await supabase
                .from('marketing')
                .insert([{ 
                    name: postData.name,
                    description: postData.description, 
                    location: postData.location,
                    category: postData.category,
                    price: parseFloat(postData.price),
                    image_url: imageUrl,
                    user_id: currentUser.email
                }]);
            
            if (error) throw error;
            
            this.loadPosts();
            return true;
        } catch (error) {
            console.error('Error publishing post:', error);
            throw error;
        }
    }

    static async uploadImage(file) {
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
            
            const { data, error } = await supabase.storage
                .from('marketing')
                .upload(fileName, file);
            
            if (error) throw error;
            
            const { data: { publicUrl } } = supabase.storage
                .from('marketing')
                .getPublicUrl(fileName);
            
            return publicUrl;
        } catch (error) {
            console.error('Error uploading image:', error);
            throw error;
        }
    }

    // وظائف جديدة للبحث والفلترة
    static initSearchAndFilter() {
        const searchInput = document.getElementById('search-input');
        const categoryFilter = document.getElementById('category-filter');
        const locationFilter = document.getElementById('location-filter');
        const resetButton = document.getElementById('reset-filters');

        // البحث أثناء الكتابة (باستخدام debounce)
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.loadPosts({ search: e.target.value });
            }, 300);
        });

        // الفلتر عند تغيير الاختيار
        categoryFilter.addEventListener('change', (e) => {
            this.loadPosts({ category: e.target.value });
        });

        locationFilter.addEventListener('change', (e) => {
            this.loadPosts({ location: e.target.value });
        });

        // إعادة تعيين الفلاتر
        resetButton.addEventListener('click', () => {
            this.resetFilters();
        });
    }

    static resetFilters() {
        document.getElementById('search-input').value = '';
        document.getElementById('category-filter').value = '';
        document.getElementById('location-filter').value = '';
        
        this.currentFilters = {
            search: '',
            category: '',
            location: ''
        };
        
        this.applyFilters();
    }
}