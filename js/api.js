// js/api.js
// API Service Layer for FBBMS

const API_BASE_URL = 'http://localhost:5000/api';

async function apiCall(endpoint, options = {}) {
    const token = localStorage.getItem('fb_token');
    
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    const config = {
        ...options,
        headers
    };
    
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'API request failed');
        }
        
        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

export const AuthAPI = {
    sendOTP: (email, password) => {
        return apiCall('/super/send-otp', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
    },
    
    verifyOTP: (email, otp) => {
        return apiCall('/super/verify-otp', {
            method: 'POST',
            body: JSON.stringify({ email, otp })
        });
    },
    
    login: (email, password) => {
        return apiCall('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
    },
    
    getProfile: () => {
        return apiCall('/auth/profile', {
            method: 'GET'
        });
    },
    
    updateProfile: (currentPassword, newPassword, confirmPassword) => {
        return apiCall('/super/profile', {
            method: 'PUT',
            body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
        });
    }
};

export const SportsSalesAPI = {
    getAll: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return apiCall(`/sports/sales?${query}`, { method: 'GET' });
    },
    
    getStats: (month, year) => {
        const query = new URLSearchParams({ month, year }).toString();
        return apiCall(`/sports/sales/stats?${query}`, { method: 'GET' });
    },
    
    getMonthlySummary: (year) => {
        const query = new URLSearchParams({ year }).toString();
        return apiCall(`/sports/sales/monthly?${query}`, { method: 'GET' });
    },
    
    add: (data) => {
        return apiCall('/sports/sales/add', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },
    
    update: (id, data) => {
        return apiCall(`/sports/sales/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },
    
    delete: (id) => {
        return apiCall(`/sports/sales/${id}`, { method: 'DELETE' });
    },
    
    getInventory: () => {
        return apiCall('/sports/sales/inventory?division=sports', { method: 'GET' });
    },
    
    getInventoryStats: () => {
        return apiCall('/sports/sales/inventory/stats?division=sports', { method: 'GET' });
    }
};

export const ScentsSalesAPI = {
    getAll: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return apiCall(`/scents/sales?${query}`, { method: 'GET' });
    },
    
    getStats: (month, year) => {
        const query = new URLSearchParams({ month, year }).toString();
        return apiCall(`/scents/sales/stats?${query}`, { method: 'GET' });
    },
    
    getMonthlySummary: (year) => {
        const query = new URLSearchParams({ year }).toString();
        return apiCall(`/scents/sales/monthly?${query}`, { method: 'GET' });
    },
    
    add: (data) => {
        return apiCall('/scents/sales/add', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },
    
    update: (id, data) => {
        return apiCall(`/scents/sales/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },
    
    delete: (id) => {
        return apiCall(`/scents/sales/${id}`, { method: 'DELETE' });
    },
    
    getInventory: () => {
        return apiCall('/scents/sales/inventory?division=scents', { method: 'GET' });
    },
    
    getInventoryStats: () => {
        return apiCall('/scents/sales/inventory/stats?division=scents', { method: 'GET' });
    }
};

export const SuperAPI = {
    sendManagerOTP: () => {
        return apiCall('/super/manager/send-otp', {
            method: 'POST',
            body: JSON.stringify({})
        });
    },
    
    getManagers: () => {
        return apiCall('/super/managers', { method: 'GET' });
    },
    
    updateManager: (id, data) => {
        return apiCall(`/super/manager/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    },
    
    deleteManager: (id, otp) => {
        return apiCall(`/super/manager/${id}`, {
            method: 'DELETE',
            body: JSON.stringify({ otp })
        });
    },
    
    getSportsToday: () => {
        return apiCall('/super/records/sports/today', { method: 'GET' });
    },
    getSportsWeekly: () => {
        return apiCall('/super/records/sports/weekly', { method: 'GET' });
    },
    getSportsMonthly: (month, year) => {
        const query = new URLSearchParams({ month, year }).toString();
        return apiCall(`/super/records/sports/monthly?${query}`, { method: 'GET' });
    },
    getSportsYearly: (year) => {
        const query = new URLSearchParams({ year }).toString();
        return apiCall(`/super/records/sports/yearly?${query}`, { method: 'GET' });
    },
    
    getScentsToday: () => {
        return apiCall('/super/records/scents/today', { method: 'GET' });
    },
    getScentsWeekly: () => {
        return apiCall('/super/records/scents/weekly', { method: 'GET' });
    },
    getScentsMonthly: (month, year) => {
        const query = new URLSearchParams({ month, year }).toString();
        return apiCall(`/super/records/scents/monthly?${query}`, { method: 'GET' });
    },
    getScentsYearly: (year) => {
        const query = new URLSearchParams({ year }).toString();
        return apiCall(`/super/records/scents/yearly?${query}`, { method: 'GET' });
    },
    
    getWeeklyOverview: (division) => {
        const query = new URLSearchParams({ division }).toString();
        return apiCall(`/super/graph/weekly-overview?${query}`, { method: 'GET' });
    },
    getDayTrend: (division, day) => {
        const query = new URLSearchParams({ division, day }).toString();
        return apiCall(`/super/graph/day-trend?${query}`, { method: 'GET' });
    },
    
    addInventory: (data) => {
        return apiCall('/super/inventory/add', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },
    getInventory: (division) => {
        const query = new URLSearchParams({ division }).toString();
        return apiCall(`/super/inventory?${query}`, { method: 'GET' });
    },
    getInventoryStats: (division) => {
        const query = new URLSearchParams({ division }).toString();
        return apiCall(`/super/inventory/stats?${query}`, { method: 'GET' });
    }
};