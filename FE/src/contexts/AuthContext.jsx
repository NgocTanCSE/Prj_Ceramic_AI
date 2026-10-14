import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

/**
 * Authentication & Saved Designs Context
 * Provides persistent authentication, user registration, login, logout,
 * password recovery, and personal 3D pottery design management.
 */

const STORAGE_KEY_USER = 'ceramic_auth_user';
const STORAGE_KEY_USERS_DB = 'ceramic_auth_users_db';
const STORAGE_KEY_SAVED_DESIGNS = 'ceramic_user_saved_designs';

// Default initial users
const DEFAULT_USERS = [
  {
    id: 'user-artisan-01',
    name: 'Nghệ Nhân Làng Gốm',
    email: 'artisan@gomviet.vn',
    passwordHash: 'GomViet1903!', // In client-side storage
    role: 'Nghệ nhân tạo mẫu',
    createdAt: '2026-01-15T08:00:00Z',
    bio: 'Chuyên nghiên cứu phục dựng men xanh đồng Vert de Biên Hòa và kỹ thuật champlevé.',
  },
  {
    id: 'user-demo-02',
    name: 'Khách Tham Quan Xưởng',
    email: 'khachhang@gomviet.vn',
    passwordHash: 'GomViet2026!',
    role: 'Học viên xưởng gốm',
    createdAt: '2026-02-10T14:30:00Z',
    bio: 'Yêu thích gốm mộc Nam Bộ và trải nghiệm vuốt phôi đất sét Tân Vạn.',
  },
];

const AuthContext = createContext(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};

export function AuthProvider({ children }) {
  // Current logged in user (or null)
  const [currentUser, setCurrentUser] = useState(() => {
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem(STORAGE_KEY_USER);
      return stored ? JSON.parse(stored) : null;
    } catch (_) {
      return null;
    }
  });

  // Local users database (persists registered accounts in browser)
  const [usersDb, setUsersDb] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_USERS;
    try {
      const stored = localStorage.getItem(STORAGE_KEY_USERS_DB);
      if (stored) {
        const parsed = JSON.parse(stored);
        return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_USERS;
      }
      localStorage.setItem(STORAGE_KEY_USERS_DB, JSON.stringify(DEFAULT_USERS));
      return DEFAULT_USERS;
    } catch (_) {
      return DEFAULT_USERS;
    }
  });

  // Saved 3D pottery designs for the current user
  const [savedDesigns, setSavedDesigns] = useState(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = localStorage.getItem(STORAGE_KEY_SAVED_DESIGNS);
      return stored ? JSON.parse(stored) : [];
    } catch (_) {
      return [];
    }
  });

  // Auth modal control state
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState('login'); // 'login' | 'register' | 'forgot' | 'profile'

  // Persist current user
  useEffect(() => {
    try {
      if (currentUser) {
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(currentUser));
      } else {
        localStorage.removeItem(STORAGE_KEY_USER);
      }
    } catch (err) {
      console.warn('Failed to save auth session:', err);
    }
  }, [currentUser]);

  // Persist users DB
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_USERS_DB, JSON.stringify(usersDb));
    } catch (err) {
      console.warn('Failed to save users database:', err);
    }
  }, [usersDb]);

  // Persist saved designs
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SAVED_DESIGNS, JSON.stringify(savedDesigns));
    } catch (err) {
      console.warn('Failed to save designs:', err);
    }
  }, [savedDesigns]);

  // ── ĐĂNG KÝ (Register) ──
  const register = useCallback(async ({ name, email, password, role = 'Khách sáng tạo gốm' }) => {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanName = (name || '').trim();

    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      throw new Error('Địa chỉ email không đúng định dạng');
    }
    if (!cleanName || cleanName.length < 2) {
      throw new Error('Họ và tên phải có ít nhất 2 ký tự');
    }
    if (!password || password.length < 6) {
      throw new Error('Mật khẩu phải chứa ít nhất 6 ký tự');
    }

    const exists = usersDb.some((u) => u.email === cleanEmail);
    if (exists) {
      throw new Error('Email này đã được đăng ký tài khoản. Vui lòng đăng nhập!');
    }

    const newUser = {
      id: `user-${Date.now()}`,
      name: cleanName,
      email: cleanEmail,
      passwordHash: password, // For mock persistence
      role,
      createdAt: new Date().toISOString(),
      bio: 'Người yêu nghệ thuật gốm sứ thủ công Việt Nam.',
    };

    setUsersDb((prev) => [...prev, newUser]);
    const sessionUser = {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      bio: newUser.bio,
      createdAt: newUser.createdAt,
    };
    setCurrentUser(sessionUser);
    return sessionUser;
  }, [usersDb]);

  // ── ĐĂNG NHẬP (Login) ──
  const login = useCallback(async ({ email, password }) => {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !password) {
      throw new Error('Vui lòng nhập đầy đủ Email và Mật khẩu');
    }

    const found = usersDb.find((u) => u.email === cleanEmail);
    if (!found) {
      throw new Error('Không tìm thấy tài khoản với email này. Vui lòng đăng ký!');
    }

    if (found.passwordHash !== password) {
      throw new Error('Mật khẩu không chính xác. Vui lòng kiểm tra lại!');
    }

    const sessionUser = {
      id: found.id,
      name: found.name,
      email: found.email,
      role: found.role,
      bio: found.bio,
      createdAt: found.createdAt,
    };
    setCurrentUser(sessionUser);
    return sessionUser;
  }, [usersDb]);

  // ── ĐĂNG XUẤT (Logout) ──
  const logout = useCallback(() => {
    setCurrentUser(null);
  }, []);

  // ── QUÊN MẬT KHẨU (Forgot Password) ──
  const requestPasswordReset = useCallback(async (email) => {
    const cleanEmail = (email || '').trim().toLowerCase();
    const found = usersDb.find((u) => u.email === cleanEmail);
    if (!found) {
      throw new Error('Email này chưa được đăng ký trong hệ thống xưởng gốm.');
    }
    // Generate temporary 6-digit verification code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    return {
      success: true,
      email: cleanEmail,
      resetCode,
      message: `Mã xác thực đặt lại mật khẩu đã được tạo: ${resetCode}. Hãy dùng mã này để cập nhật mật khẩu mới!`,
    };
  }, [usersDb]);

  // ── CẬP NHẬT MẬT KHẨU MỚI ──
  const resetPassword = useCallback(async ({ email, newPassword }) => {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!newPassword || newPassword.length < 6) {
      throw new Error('Mật khẩu mới phải có tối thiểu 6 ký tự');
    }

    setUsersDb((prev) =>
      prev.map((u) => (u.email === cleanEmail ? { ...u, passwordHash: newPassword } : u))
    );

    return { success: true, message: 'Đổi mật khẩu thành công! Bạn có thể đăng nhập ngay.' };
  }, []);

  // ── CẬP NHẬT HỒ SƠ ──
  const updateProfile = useCallback(async ({ name, bio, role }) => {
    if (!currentUser) throw new Error('Chưa đăng nhập');
    const updated = {
      ...currentUser,
      name: name ?? currentUser.name,
      bio: bio ?? currentUser.bio,
      role: role ?? currentUser.role,
    };
    setCurrentUser(updated);
    setUsersDb((prev) => prev.map((u) => (u.id === currentUser.id ? { ...u, ...updated } : u)));
    return updated;
  }, [currentUser]);

  // ── LƯU THIẾT KẾ 3D CÁ NHÂN ──
  const saveDesign = useCallback((designData) => {
    const newDesign = {
      id: `design-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userId: currentUser?.id || 'guest',
      title: designData.title || `Tác phẩm Gốm ${new Date().toLocaleDateString('vi-VN')}`,
      modelType: designData.modelType || 'vase',
      glazeColor: designData.glazeColor || '#2A6B5C',
      glazeName: designData.glazeName || 'Men Xanh Đồng',
      glazeRoughness: designData.glazeRoughness ?? 0.16,
      pattern: designData.pattern || 'none',
      patternImage: designData.patternImage || null,
      patternTransform: designData.patternTransform || null,
      customText: designData.customText || '',
      textTransform: designData.textTransform || null,
      customLathePoints: designData.customLathePoints || null,
      paintedCanvasData: designData.paintedCanvasData || null,
      snapshot: designData.snapshot || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setSavedDesigns((prev) => [newDesign, ...prev]);
    return newDesign;
  }, [currentUser]);

  // ── XÓA THIẾT KẾ ĐÃ LƯU ──
  const removeSavedDesign = useCallback((designId) => {
    setSavedDesigns((prev) => prev.filter((d) => d.id !== designId));
  }, []);

  const openAuthModal = useCallback((tab = 'login') => {
    setAuthModalTab(tab);
    setIsAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setIsAuthModalOpen(false);
  }, []);

  const value = useMemo(
    () => ({
      currentUser,
      isAuthenticated: !!currentUser,
      savedDesigns: currentUser
        ? savedDesigns.filter((d) => d.userId === currentUser.id || d.userId === 'guest')
        : savedDesigns,
      allSavedDesigns: savedDesigns,
      register,
      login,
      logout,
      requestPasswordReset,
      resetPassword,
      updateProfile,
      saveDesign,
      removeSavedDesign,
      isAuthModalOpen,
      authModalTab,
      setAuthModalTab,
      openAuthModal,
      closeAuthModal,
    }),
    [
      currentUser,
      savedDesigns,
      register,
      login,
      logout,
      requestPasswordReset,
      resetPassword,
      updateProfile,
      saveDesign,
      removeSavedDesign,
      isAuthModalOpen,
      authModalTab,
      openAuthModal,
      closeAuthModal,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
