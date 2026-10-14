import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useDesign } from '../contexts/DesignContext';
import { useNavigation } from '../contexts/NavigationContext';
import { useToast } from '../contexts/ToastContext';

export default function AuthModal() {
  const {
    currentUser,
    isAuthenticated,
    savedDesigns,
    login,
    register,
    logout,
    requestPasswordReset,
    resetPassword,
    isAuthModalOpen,
    authModalTab,
    setAuthModalTab,
    closeAuthModal,
    removeSavedDesign,
  } = useAuth();

  const {
    setModelType,
    setGlazeColor,
    setGlazeName,
    setGlazeRoughness,
    setPattern,
    setPatternImage,
    setPatternTransform,
    setCustomText,
    setTextTransform,
    setCustomLathePoints,
  } = useDesign();

  const { setActiveTab } = useNavigation();
  const { showToast } = useToast();

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [generatedResetCode, setGeneratedResetCode] = useState('');
  const [showResetCodeInput, setShowResetCodeInput] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (!isAuthModalOpen) return null;

  const resetFormState = () => {
    setEmail('');
    setPassword('');
    setName('');
    setConfirmPassword('');
    setResetCode('');
    setGeneratedResetCode('');
    setShowResetCodeInput(false);
    setErrorMessage('');
    setSuccessMessage('');
  };

  const switchTab = (tab) => {
    resetFormState();
    setAuthModalTab(tab);
  };

  // ── XỬ LÝ ĐĂNG NHẬP ──
  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setIsLoading(true);

    try {
      const user = await login({ email, password });
      showToast(`Kính chào ${user.name}! Đăng nhập thành công.`, 'success');
      closeAuthModal();
      resetFormState();
    } catch (err) {
      setErrorMessage(err.message || 'Đăng nhập không thành công');
    } finally {
      setIsLoading(false);
    }
  };

  // ── XỬ LÝ ĐĂNG KÝ ──
  const handleRegister = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (password !== confirmPassword) {
      setErrorMessage('Mật khẩu xác nhận không khớp');
      return;
    }

    setIsLoading(true);
    try {
      const user = await register({ name, email, password });
      showToast(`Chào mừng ${user.name} đến với Xưởng Gốm Việt 3D!`, 'success');
      closeAuthModal();
      resetFormState();
    } catch (err) {
      setErrorMessage(err.message || 'Đăng ký thất bại');
    } finally {
      setIsLoading(false);
    }
  };

  // ── XỬ LÝ QUÊN MẬT KHẨU ──
  const handleRequestReset = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setIsLoading(true);

    try {
      const result = await requestPasswordReset(email);
      setGeneratedResetCode(result.resetCode);
      setShowResetCodeInput(true);
      setSuccessMessage(`Đã tạo mã xác thực: ${result.resetCode}. Vui lòng nhập mã và mật khẩu mới.`);
      showToast('Đã gửi mã xác thực khôi phục mật khẩu!', 'info');
    } catch (err) {
      setErrorMessage(err.message || 'Lỗi khi yêu cầu khôi phục');
    } finally {
      setIsLoading(false);
    }
  };

  // ── XỬ LÝ ĐỔI MẬT KHẨU ──
  const handleConfirmReset = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (resetCode.trim() !== generatedResetCode.trim()) {
      setErrorMessage('Mã xác thực không đúng. Vui lòng kiểm tra lại');
      return;
    }

    setIsLoading(true);
    try {
      await resetPassword({ email, newPassword: password });
      showToast('Đã đổi mật khẩu thành công! Hãy đăng nhập.', 'success');
      switchTab('login');
    } catch (err) {
      setErrorMessage(err.message || 'Đổi mật khẩu thất bại');
    } finally {
      setIsLoading(false);
    }
  };

  // ── NẠP THIẾT KẾ ĐÃ LƯU VÀO XƯỞNG 3D ──
  const handleLoadDesignIntoStudio = (design) => {
    if (setModelType && design.modelType) setModelType(design.modelType);
    if (setGlazeColor && design.glazeColor) setGlazeColor(design.glazeColor);
    if (setGlazeName && design.glazeName) setGlazeName(design.glazeName);
    if (setGlazeRoughness && design.glazeRoughness !== undefined) setGlazeRoughness(design.glazeRoughness);
    if (setPattern && design.pattern) setPattern(design.pattern);
    if (setPatternImage) setPatternImage(design.patternImage || null);
    if (setPatternTransform && design.patternTransform) setPatternTransform(design.patternTransform);
    if (setCustomText && design.customText) setCustomText(design.customText);
    if (setTextTransform && design.textTransform) setTextTransform(design.textTransform);
    if (setCustomLathePoints && design.customLathePoints) setCustomLathePoints(design.customLathePoints);

    closeAuthModal();
    setActiveTab('studio-3d');
    showToast(`Đã nạp thiết kế "${design.title}" vào Xưởng 3D!`, 'success');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ceramic-charcoal/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="bg-ceramic-paper border border-ceramic-border w-full max-w-md rounded-3xl shadow-card overflow-hidden flex flex-col max-h-[90vh]">
        {/* ── Header ── */}
        <div className="bg-ceramic-cream px-6 py-4 border-b border-ceramic-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-ceramic-terracotta text-ceramic-paper flex items-center justify-center font-editorial text-sm font-bold shadow-paper">
              G
            </div>
            <div>
              <h2 id="auth-modal-title" className="font-editorial text-base font-bold text-ceramic-charcoal leading-none">
                {authModalTab === 'login' && 'Đăng nhập xưởng gốm'}
                {authModalTab === 'register' && 'Tạo tài khoản mới'}
                {authModalTab === 'forgot' && 'Khôi phục mật khẩu'}
                {authModalTab === 'profile' && 'Hồ sơ & Bản thiết kế của bạn'}
              </h2>
              <div className="text-[10px] text-ceramic-slate font-mono mt-0.5">
                Làng nghề gốm Biên Hòa - Tân Vạn
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={closeAuthModal}
            className="w-8 h-8 rounded-xl bg-ceramic-paper hover:bg-ceramic-border/60 text-ceramic-slate hover:text-ceramic-charcoal flex items-center justify-center transition-colors text-lg cursor-pointer"
            aria-label="Đóng"
          >
            ×
          </button>
        </div>

        {/* ── Tabs Navigation (khi chưa đăng nhập) ── */}
        {!isAuthenticated && authModalTab !== 'forgot' && (
          <div className="flex border-b border-ceramic-border bg-ceramic-paper text-xs font-mono">
            <button
              type="button"
              onClick={() => switchTab('login')}
              className={`flex-1 py-3 text-center transition-colors border-b-2 cursor-pointer font-semibold ${
                authModalTab === 'login'
                  ? 'border-ceramic-terracotta text-ceramic-terracotta bg-ceramic-cream/50'
                  : 'border-transparent text-ceramic-slate hover:text-ceramic-charcoal'
              }`}
            >
              Đăng nhập
            </button>
            <button
              type="button"
              onClick={() => switchTab('register')}
              className={`flex-1 py-3 text-center transition-colors border-b-2 cursor-pointer font-semibold ${
                authModalTab === 'register'
                  ? 'border-ceramic-terracotta text-ceramic-terracotta bg-ceramic-cream/50'
                  : 'border-transparent text-ceramic-slate hover:text-ceramic-charcoal'
              }`}
            >
              Đăng ký tài khoản
            </button>
          </div>
        )}

        {/* ── Body ── */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* Thông báo lỗi / thành công */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-mono flex items-center gap-2">
              <span>⚠️</span>
              <span>{errorMessage}</span>
            </div>
          )}
          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-mono flex items-center gap-2">
              <span>✓</span>
              <span>{successMessage}</span>
            </div>
          )}

          {/* ══════════════════════════════════════════════════
              TAB 1: ĐĂNG NHẬP
              ══════════════════════════════════════════════════ */}
          {authModalTab === 'login' && !isAuthenticated && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-mono font-semibold text-ceramic-charcoal block">
                  Địa chỉ Email:
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="artisan@gomviet.vn"
                  className="w-full text-xs px-3.5 py-2.5 bg-ceramic-paper rounded-xl border border-ceramic-border focus:outline-none focus:border-ceramic-terracotta font-mono text-ceramic-charcoal shadow-paper"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-mono font-semibold text-ceramic-charcoal">
                    Mật khẩu:
                  </label>
                  <button
                    type="button"
                    onClick={() => switchTab('forgot')}
                    className="text-[11px] text-ceramic-terracotta hover:underline font-mono cursor-pointer"
                  >
                    Quên mật khẩu?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full text-xs px-3.5 py-2.5 bg-ceramic-paper rounded-xl border border-ceramic-border focus:outline-none focus:border-ceramic-terracotta font-mono text-ceramic-charcoal shadow-paper pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-xs text-ceramic-slate hover:text-ceramic-charcoal font-mono"
                  >
                    {showPassword ? 'Ẩn' : 'Hiện'}
                  </button>
                </div>
              </div>

              {/* Tài khoản gợi ý sẵn để kiểm thử nhanh */}
              <div className="p-3 rounded-xl bg-ceramic-cream/70 border border-ceramic-border text-[11px] font-mono text-ceramic-slate space-y-1">
                <div className="font-semibold text-ceramic-charcoal">💡 Tài khoản thử nghiệm có sẵn:</div>
                <div className="flex items-center justify-between">
                  <span>artisan@gomviet.vn</span>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail('artisan@gomviet.vn');
                      setPassword('GomViet1903!');
                    }}
                    className="text-ceramic-terracotta hover:underline font-bold"
                  >
                    Điền nhanh
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-xl bg-ceramic-terracotta hover:bg-ceramic-charcoal text-ceramic-paper text-xs font-mono uppercase tracking-wider font-semibold transition-colors shadow-paper cursor-pointer disabled:opacity-50"
              >
                {isLoading ? 'Đang xác thực...' : 'Đăng nhập vào xưởng →'}
              </button>
            </form>
          )}

          {/* ══════════════════════════════════════════════════
              TAB 2: ĐĂNG KÝ
              ══════════════════════════════════════════════════ */}
          {authModalTab === 'register' && !isAuthenticated && (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-mono font-semibold text-ceramic-charcoal block">
                  Họ và tên của bạn:
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nguyễn Văn Nghệ"
                  className="w-full text-xs px-3.5 py-2.5 bg-ceramic-paper rounded-xl border border-ceramic-border focus:outline-none focus:border-ceramic-terracotta font-mono text-ceramic-charcoal shadow-paper"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-mono font-semibold text-ceramic-charcoal block">
                  Email đăng ký:
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ban@gomviet.vn"
                  className="w-full text-xs px-3.5 py-2.5 bg-ceramic-paper rounded-xl border border-ceramic-border focus:outline-none focus:border-ceramic-terracotta font-mono text-ceramic-charcoal shadow-paper"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-mono font-semibold text-ceramic-charcoal block">
                  Mật khẩu (tối thiểu 6 ký tự):
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full text-xs px-3.5 py-2.5 bg-ceramic-paper rounded-xl border border-ceramic-border focus:outline-none focus:border-ceramic-terracotta font-mono text-ceramic-charcoal shadow-paper"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-mono font-semibold text-ceramic-charcoal block">
                  Xác nhận lại mật khẩu:
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full text-xs px-3.5 py-2.5 bg-ceramic-paper rounded-xl border border-ceramic-border focus:outline-none focus:border-ceramic-terracotta font-mono text-ceramic-charcoal shadow-paper"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-xl bg-ceramic-terracotta hover:bg-ceramic-charcoal text-ceramic-paper text-xs font-mono uppercase tracking-wider font-semibold transition-colors shadow-paper cursor-pointer disabled:opacity-50 mt-2"
              >
                {isLoading ? 'Đang tạo tài khoản...' : 'Hoàn tất đăng ký →'}
              </button>
            </form>
          )}

          {/* ══════════════════════════════════════════════════
              TAB 3: QUÊN MẬT KHẨU
              ══════════════════════════════════════════════════ */}
          {authModalTab === 'forgot' && (
            <div className="space-y-4">
              {!showResetCodeInput ? (
                <form onSubmit={handleRequestReset} className="space-y-4">
                  <p className="text-xs text-ceramic-slate leading-relaxed">
                    Nhập email bạn đã đăng ký để nhận mã khôi phục mật khẩu xưởng gốm.
                  </p>
                  <div className="space-y-1">
                    <label className="text-xs font-mono font-semibold text-ceramic-charcoal block">
                      Địa chỉ Email:
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="artisan@gomviet.vn"
                      className="w-full text-xs px-3.5 py-2.5 bg-ceramic-paper rounded-xl border border-ceramic-border focus:outline-none focus:border-ceramic-terracotta font-mono text-ceramic-charcoal shadow-paper"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => switchTab('login')}
                      className="flex-1 py-2.5 rounded-xl border border-ceramic-border text-xs font-mono text-ceramic-slate hover:bg-ceramic-cream cursor-pointer"
                    >
                      ← Quay lại
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="flex-1 py-2.5 rounded-xl bg-ceramic-terracotta hover:bg-ceramic-charcoal text-ceramic-paper text-xs font-mono font-semibold transition-colors cursor-pointer"
                    >
                      {isLoading ? 'Đang gửi...' : 'Tạo mã khôi phục'}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleConfirmReset} className="space-y-3.5">
                  <div className="space-y-1">
                    <label className="text-xs font-mono font-semibold text-ceramic-charcoal block">
                      Mã xác thực 6 số:
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={resetCode}
                      onChange={(e) => setResetCode(e.target.value)}
                      placeholder="VD: 123456"
                      className="w-full text-xs px-3.5 py-2.5 bg-ceramic-paper rounded-xl border border-ceramic-border focus:outline-none focus:border-ceramic-terracotta font-mono text-ceramic-charcoal shadow-paper tracking-widest text-center text-sm font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-mono font-semibold text-ceramic-charcoal block">
                      Mật khẩu mới:
                    </label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full text-xs px-3.5 py-2.5 bg-ceramic-paper rounded-xl border border-ceramic-border focus:outline-none focus:border-ceramic-terracotta font-mono text-ceramic-charcoal shadow-paper"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 rounded-xl bg-ceramic-terracotta hover:bg-ceramic-charcoal text-ceramic-paper text-xs font-mono uppercase tracking-wider font-semibold transition-colors cursor-pointer"
                  >
                    {isLoading ? 'Đang cập nhật...' : 'Xác nhận đặt lại mật khẩu'}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════
              TAB 4: HỒ SƠ & BỘ SƯU TẬP THIẾT KẾ CÁ NHÂN
              ══════════════════════════════════════════════════ */}
          {(authModalTab === 'profile' || isAuthenticated) && (
            <div className="space-y-5">
              {currentUser && (
                <div className="p-4 rounded-2xl bg-ceramic-cream/60 border border-ceramic-border space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="font-editorial text-lg font-bold text-ceramic-charcoal">
                      {currentUser.name}
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-ceramic-terracotta text-ceramic-paper">
                      {currentUser.role}
                    </span>
                  </div>
                  <div className="text-xs font-mono text-ceramic-slate">
                    {currentUser.email}
                  </div>
                  {currentUser.bio && (
                    <div className="text-xs text-ceramic-slate italic pt-1 border-t border-ceramic-border/50">
                      "{currentUser.bio}"
                    </div>
                  )}
                </div>
              )}

              {/* Danh sách thiết kế 3D đã lưu */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs font-mono text-ceramic-slate">
                  <span className="font-bold text-ceramic-charcoal uppercase">
                    Bản thiết kế 3D của bạn ({savedDesigns.length})
                  </span>
                  <span className="text-[10px]">Tự động lưu trữ</span>
                </div>

                {savedDesigns.length === 0 ? (
                  <div className="p-6 text-center rounded-2xl border border-dashed border-ceramic-border text-xs text-ceramic-slate space-y-2">
                    <div className="text-2xl">🏺</div>
                    <div>Bạn chưa lưu tác phẩm nào.</div>
                    <p className="text-[11px]">
                      Vào mục "Xưởng tạo hình" và nhấn nút "Lưu thiết kế" để lưu lại phôi men vào hồ sơ cá nhân.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {savedDesigns.map((d) => (
                      <div
                        key={d.id}
                        className="p-3 rounded-xl border border-ceramic-border bg-ceramic-paper hover:bg-ceramic-cream/40 transition-colors flex items-center justify-between gap-3 shadow-paper"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {d.snapshot ? (
                            <img
                              src={d.snapshot}
                              alt={d.title}
                              className="w-10 h-10 object-cover rounded-lg border border-ceramic-border bg-ceramic-cream flex-shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-ceramic-cream border border-ceramic-border flex items-center justify-center text-base flex-shrink-0">
                              🏺
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-ceramic-charcoal truncate">
                              {d.title}
                            </div>
                            <div className="text-[10px] font-mono text-ceramic-slate truncate">
                              {d.glazeName} • {new Date(d.createdAt).toLocaleDateString('vi-VN')}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => handleLoadDesignIntoStudio(d)}
                            className="px-2.5 py-1 rounded-lg bg-ceramic-terracotta text-ceramic-paper text-[10px] font-mono font-semibold hover:bg-ceramic-charcoal transition-colors cursor-pointer"
                            title="Mở trong 3D Studio"
                          >
                            Mở 3D
                          </button>
                          <button
                            type="button"
                            onClick={() => removeSavedDesign(d.id)}
                            className="w-6 h-6 rounded-lg text-ceramic-slate hover:text-red-600 hover:bg-red-50 flex items-center justify-center text-xs transition-colors cursor-pointer"
                            title="Xóa bản thiết kế"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Nút Đăng xuất */}
              {isAuthenticated && (
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    showToast('Đã đăng xuất khỏi xưởng gốm.', 'info');
                    closeAuthModal();
                  }}
                  className="w-full py-2.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 text-xs font-mono font-medium transition-colors cursor-pointer mt-3"
                >
                  Đăng xuất tài khoản
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
