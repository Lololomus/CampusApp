// ===== 📄 ФАЙЛ: src/components/EditProfile.js =====

import React, { useState, useEffect } from 'react';
import { 
  X, Camera, User, AtSign, 
  BookOpen, Layers, Hash, ChevronRight 
} from 'lucide-react';
import { useStore } from '../../store';
import { updateUserProfile, uploadUserAvatar } from '../../api';
import { hapticFeedback } from '../../utils/telegram';
import { Z_EDIT_PROFILE } from '../../constants/zIndex';

// КОНСТАНТЫ
const UNIVERSITIES = ["РУК", "МГУ", "ВШЭ", "МГТУ", "РАНХиГС", "Другой"];
const INSTITUTES = ["ИСА", "Юридический", "Экономический", "Менеджмент", "Гостиничный сервис", "Другой"];
const COURSES = [1, 2, 3, 4, 5, 6];

function EditProfile() {
  const { user, setUser, setShowEditModal } = useStore();
  
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    university: '',
    institute: '',
    course: '',
    group: ''
  });

  const [avatarPreview, setAvatarPreview] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        username: user.username || '',
        university: user.university || '',
        institute: user.institute || '',
        course: user.course || '',
        group: user.group || ''
      });
      setAvatarPreview(user.avatar);
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleClose = () => {
    hapticFeedback('light');
    setShowEditModal(false);
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      hapticFeedback('selection');
      const reader = new FileReader();
      reader.onloadend = () => setAvatarPreview(reader.result);
      reader.readAsDataURL(file);

      try {
        setLoading(true);
        const newAvatarData = await uploadUserAvatar(file);
        if (newAvatarData && newAvatarData.avatar) {
           setUser({ ...user, avatar: newAvatarData.avatar });
        }
      } catch (error) {
        console.error("Ошибка загрузки фото", error);
        alert("Не удалось загрузить фото");
        setAvatarPreview(user.avatar);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSave = async () => {
    hapticFeedback('success');
    setLoading(true);
    
    try {
      const cleanUsername = formData.username.replace('@', '').trim();

      const updateData = {
        name: formData.name,
        username: cleanUsername,
        // Bio не отправляем
        university: formData.university,
        institute: formData.institute,
        course: parseInt(formData.course),
        group: formData.group
      };

      const updatedUser = await updateUserProfile(updateData);
      setUser(updatedUser);
      handleClose();
    } catch (error) {
      console.error("Ошибка сохранения", error);
      if (error.response && error.response.status === 403) {
          alert(error.response.data.detail || "Нельзя часто менять учебные данные");
      } else {
          alert("Ошибка сохранения изменений");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.container} className="slide-in-right">
        
        {/* HEADER */}
        <div style={styles.header}>
          <button onClick={handleClose} style={styles.iconButton}>
            <X size={24} color="#fff" />
          </button>
          <span style={styles.headerTitle}>Редактирование</span>
          <div style={{width: 44}}></div>
        </div>

        <div style={styles.scrollContent}>
          
          {/* AVATAR */}
          <div style={styles.avatarSection}>
            <div style={styles.avatarWrapper}>
              {avatarPreview ? (
                <img src={avatarPreview} style={styles.avatarImg} alt="avatar" />
              ) : (
                <div style={styles.avatarPlaceholder}>{formData.name?.[0]}</div>
              )}
              <label style={styles.cameraButton}>
                <input type="file" accept="image/*" onChange={handleAvatarChange} style={{display: 'none'}} />
                <Camera size={20} color="#fff" />
              </label>
            </div>
            <div style={styles.avatarHint}>Нажмите на фото, чтобы изменить</div>
          </div>

          {/* ОСНОВНОЕ */}
          <div style={styles.sectionTitle}>ОСНОВНОЕ</div>
          <div style={styles.card}>
            <div style={styles.inputGroup}>
              <div style={styles.inputIcon}><User size={18} color="#666" /></div>
              <input 
                style={styles.input} 
                name="name" 
                value={formData.name} 
                onChange={handleChange} 
                placeholder="Ваше имя" 
              />
            </div>
            
            <div style={styles.divider} />

            <div style={styles.inputGroup}>
              <div style={styles.inputIcon}><AtSign size={18} color="#8b5cf6" /></div>
              <input 
                style={{...styles.input, color: '#8b5cf6', fontWeight: '500'}} 
                name="username" 
                value={formData.username} 
                onChange={handleChange} 
                placeholder="username" 
                autoCapitalize="none" 
              />
            </div>
          </div>

          {/* СТУДЕНТ */}
          <div style={styles.sectionTitle}>СТУДЕНТ</div>
          <div style={styles.card}>
             
             {/* ВУЗ */}
             <div style={styles.inputGroup}>
               <div style={styles.inputIcon}><BookOpen size={18} color="#666" /></div>
               <div style={styles.selectWrapper}>
                 <select 
                    style={styles.select} 
                    name="university" 
                    value={formData.university} 
                    onChange={handleChange}
                 >
                    <option value="" disabled>Выберите ВУЗ</option>
                    {UNIVERSITIES.map(u => <option key={u} value={u}>{u}</option>)}
                 </select>
                 <ChevronRight size={16} color="#444" style={styles.selectArrow}/>
               </div>
             </div>
             
             <div style={styles.divider} />
             
             {/* Институт */}
             <div style={styles.inputGroup}>
               <div style={styles.inputIcon}><Layers size={18} color="#666" /></div>
               <div style={styles.selectWrapper}>
                 <select 
                    style={styles.select} 
                    name="institute" 
                    value={formData.institute} 
                    onChange={handleChange}
                 >
                    <option value="" disabled>Выберите институт</option>
                    {INSTITUTES.map(i => <option key={i} value={i}>{i}</option>)}
                 </select>
                 <ChevronRight size={16} color="#444" style={styles.selectArrow}/>
               </div>
             </div>

             <div style={styles.divider} />

             {/* Курс и Группа */}
             <div style={{display: 'flex'}}>
                <div style={{...styles.inputGroup, flex: 1}}>
                  <div style={styles.inputIcon}><Hash size={18} color="#666" /></div>
                  <div style={styles.selectWrapper}>
                    <select 
                        style={styles.select} 
                        name="course" 
                        value={formData.course} 
                        onChange={handleChange}
                    >
                        <option value="" disabled>Курс</option>
                        {COURSES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <ChevronRight size={16} color="#444" style={styles.selectArrow}/>
                  </div>
                </div>
                
                <div style={{width: 1, background: '#333'}}></div>
                
                <div style={{...styles.inputGroup, flex: 1}}>
                  <div style={styles.inputIcon}><User size={18} color="#666" /></div>
                  <input 
                    style={styles.input} 
                    name="group" 
                    value={formData.group} 
                    onChange={handleChange} 
                    placeholder="Группа" 
                  />
                </div>
             </div>
          </div>
          
          <div style={{height: 100}} />
        </div>
        
        {/* FOOTER */}
        <div style={styles.footer}>
             <button style={styles.bigSaveButton} onClick={handleSave} disabled={loading}>
                 {loading ? 'Сохранение...' : 'Сохранить изменения'}
             </button>
        </div>

      </div>
      
      <style>{`
        .slide-in-right { animation: slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
        
        /* Убираем дефолтные стрелки */
        select { -webkit-appearance: none; -moz-appearance: none; appearance: none; }
        
        /* 🔥 ВАЖНО: Делаем выпадающий список темным */
        select option {
            background-color: #1e1e1e;
            color: #fff;
            padding: 10px;
        }
      `}</style>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#000', 
    zIndex: Z_EDIT_PROFILE,
    display: 'flex', flexDirection: 'column',
  },
  container: {
    flex: 1, display: 'flex', flexDirection: 'column',
    backgroundColor: '#121212', height: '100%',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '16px', borderBottom: '1px solid #222',
    backgroundColor: '#121212', zIndex: 10,
  },
  headerTitle: {
    fontSize: '17px', fontWeight: '600', color: '#fff',
  },
  iconButton: {
    background: 'none', border: 'none', padding: 8, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    minWidth: 44, minHeight: 44,
  },
  scrollContent: {
    flex: 1, overflowY: 'auto', padding: '20px',
  },
  
  // Avatar
  avatarSection: { display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 },
  avatarWrapper: { position: 'relative', width: 100, height: 100 },
  avatarImg: { width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '2px solid #333' },
  avatarPlaceholder: { width: '100%', height: '100%', borderRadius: '50%', backgroundColor: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px', color: '#666', fontWeight: 'bold' },
  cameraButton: { position: 'absolute', bottom: 0, right: 0, width: 36, height: 36, borderRadius: '50%', backgroundColor: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid #121212', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' },
  avatarHint: { marginTop: 12, fontSize: '13px', color: '#666' },

  // Sections
  sectionTitle: { fontSize: '12px', fontWeight: '700', color: '#666', marginBottom: 8, paddingLeft: 12, letterSpacing: '0.5px' },
  card: { backgroundColor: '#1e1e1e', borderRadius: 16, overflow: 'hidden', marginBottom: 24 },
  
  // Inputs
  inputGroup: { display: 'flex', alignItems: 'center', minHeight: 48, padding: '0 16px' },
  inputIcon: { marginRight: 12, display: 'flex', alignItems: 'center' },
  input: { flex: 1, background: 'transparent', border: 'none', color: '#fff', fontSize: '16px', height: '100%', outline: 'none', padding: '12px 0' },
  
  // Selects (Background must be set explicitly here too)
  selectWrapper: { flex: 1, position: 'relative', display: 'flex', alignItems: 'center' },
  select: { 
    width: '100%', 
    background: 'transparent', // Фон самого инпута прозрачный
    border: 'none', 
    color: '#fff', 
    fontSize: '16px', height: '48px', 
    outline: 'none', cursor: 'pointer', zIndex: 2 
  },
  selectArrow: { position: 'absolute', right: 0, pointerEvents: 'none' },

  divider: { height: 1, backgroundColor: '#333', marginLeft: 46 },
  
  footer: { padding: '16px 20px 30px 20px', borderTop: '1px solid #222', backgroundColor: '#121212' },
  bigSaveButton: { 
    width: '100%', padding: '14px', borderRadius: 16, border: 'none', cursor: 'pointer', 
    background: '#8b5cf6', 
    color: '#fff', fontSize: '16px', fontWeight: '700', 
    boxShadow: '0 4px 20px rgba(139, 92, 246, 0.4)', 
    transition: 'transform 0.1s' 
  }
};

export default EditProfile;