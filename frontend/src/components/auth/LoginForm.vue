<!-- frontend/src/components/auth/LoginForm.vue -->
<template>
  <form @submit.prevent="handleSubmit" class="auth-form">
    <!-- Champ Email -->
    <div class="form-group">
      <label for="email" class="form-label">
        <span class="label-text">Identifiant</span>
        <span class="label-hint">Votre email professionnel</span>
      </label>
      
      <div 
        class="input-wrapper" 
        :class="{ 
          'focused': formState.email.focused,
          'error': emailError,
          'success': formState.email.touched && !emailError && formState.email.value
        }"
      >
        <div class="input-icon">📧</div>
        
        <input
          id="email"
          v-model="formState.email.value"
          type="email"
          placeholder="exemple@entreprise.fr"
          @focus="formState.email.focused = true"
          @blur="formState.email.focused = false; markAsTouched('email')"
          @input="formState.email.touched = true"
          :disabled="loading"
          required
        />
        
        <div class="input-underline"></div>
        
        <Transition name="fade">
          <span v-if="formState.email.touched && !emailError && formState.email.value" class="validation-icon">
            ✅
          </span>
        </Transition>
      </div>
      
      <Transition name="slide-fade">
        <div v-if="emailError" class="field-error">
          <span class="error-icon">⚠️</span>
          {{ emailError }}
        </div>
      </Transition>
    </div>

    <!-- Champ Mot de passe -->
    <div class="form-group">
      <div class="label-row">
        <label for="password" class="form-label">
          <span class="label-text">Mot de passe</span>
        </label>
        <button 
          type="button" 
          class="forgot-link" 
          @click="$emit('forgot-password')"
          :disabled="loading"
        >
          Mot de passe oublié ?
        </button>
      </div>
      
      <div 
        class="input-wrapper" 
        :class="{ 
          'focused': formState.password.focused,
          'error': passwordError,
          'success': formState.password.touched && !passwordError && formState.password.value
        }"
      >
        <div class="input-icon">🔒</div>
        
        <input
          id="password"
          v-model="formState.password.value"
          :type="showPassword ? 'text' : 'password'"
          placeholder="Votre mot de passe"
          @focus="formState.password.focused = true"
          @blur="formState.password.focused = false; markAsTouched('password')"
          @input="formState.password.touched = true"
          :disabled="loading"
          required
        />
        
        <button
          type="button"
          class="password-toggle"
          @click="toggleShowPassword"
          :aria-label="showPassword ? 'Masquer' : 'Afficher'"
          :disabled="loading"
        >
          <span v-if="showPassword">👁️‍🗨️</span>
          <span v-else>👁️</span>
        </button>
        
        <div class="input-underline"></div>
      </div>
      
      <Transition name="slide-fade">
        <div v-if="passwordError" class="field-error">
          <span class="error-icon">⚠️</span>
          {{ passwordError }}
        </div>
      </Transition>
    </div>

    <!-- Options -->
    <div class="form-group remember-group">
      <label class="checkbox-container">
        <input 
          type="checkbox" 
          v-model="formState.remember.value"
          class="checkbox-input"
          :disabled="loading"
        />
        <span class="checkbox-custom"></span>
        <span class="checkbox-label">Se souvenir de moi</span>
      </label>
    </div>

    <!-- Bouton de connexion -->
    <button
      type="submit"
      class="submit-button"
      :disabled="loading || !isFormValid"
      :class="{ 
        'loading': loading,
        'disabled': !isFormValid
      }"
    >
      <span v-if="!loading" class="button-text">
        Se connecter
      </span>
      <span v-else class="loading-spinner">
        <span class="spinner"></span>
        Connexion en cours...
      </span>
    </button>

    <!-- Message d'erreur global -->
    <Transition name="shake">
      <div v-if="error" class="error-message">
        <div class="error-icon">⚠️</div>
        <span class="error-text">{{ error }}</span>
        <button 
          class="error-close" 
          @click="$emit('clear-error')"
          aria-label="Fermer"
          type="button"
        >
          ✕
        </button>
      </div>
    </Transition>

    <!-- Support -->
    <div class="support-section">
      <p class="support-text">
        Besoin d'aide ? 
        <button 
          type="button" 
          class="support-link" 
          @click="$emit('support')"
          :disabled="loading"
        >
          Contacter le support
        </button>
      </p>
    </div>
  </form>
</template>

<script setup lang="ts">
import { watch } from 'vue';
import { useAuthForm } from '@/composables/useAuthForm';

interface Props {
  loading?: boolean;
  error?: string | null;
}

interface Emits {
  (e: 'submit', credentials: { email: string; password: string; remember: boolean }): void;
  (e: 'clear-error'): void;
  (e: 'forgot-password'): void;
  (e: 'support'): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// Composable
const { 
  formState, 
  showPassword, 
  isFormValid, 
  emailError, 
  passwordError,
  validateForm,
  markAsTouched,
  toggleShowPassword,
  resetForm
} = useAuthForm();

// Soumission du formulaire
const handleSubmit = () => {
  if (!validateForm()) return;
  
  emit('submit', {
    email: formState.email.value.trim(),
    password: formState.password.value,
    remember: formState.remember.value
  });
};

// Réinitialisation du formulaire en cas d'erreur
watch(() => props.error, (newError) => {
  if (newError) {
    // Ne pas réinitialiser, juste garder les valeurs
  }
});

// Reset du formulaire quand le composant est démonté
watch(() => props.loading, (newLoading) => {
  if (!newLoading && !props.error) {
    // Optionnel: reset seulement si succès
  }
});
</script>

<style scoped lang="scss">
.auth-form {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.form-label {
  display: flex;
  flex-direction: column;
  gap: 2px;
  
  .label-text {
    font-size: 0.9rem;
    font-weight: 600;
    color: white;
  }
  
  .label-hint {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.5);
  }
}

.forgot-link {
  background: none;
  border: none;
  color: #60a5fa;
  font-size: 0.8rem;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
  
  &:hover:not(:disabled) {
    background: rgba(96, 165, 250, 0.1);
    color: #93c5fd;
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

/* Input wrapper */
.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  
  &:hover:not(.error):not(.success) {
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.1);
  }
  
  &.focused {
    background: rgba(255, 255, 255, 0.06);
    border-color: #3b82f6;
    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
  }
  
  &.error {
    border-color: #ef4444;
    background: rgba(239, 68, 68, 0.03);
    
    &:hover {
      border-color: #ef4444;
    }
  }
  
  &.success {
    border-color: #10b981;
  }
}

.input-icon {
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 18px;
  color: rgba(255, 255, 255, 0.5);
  transition: color 0.2s;
  
  .focused & {
    color: #60a5fa;
  }
}

input {
  width: 100%;
  height: 52px;
  padding: 0 48px;
  background: none;
  border: none;
  color: white;
  font-size: 0.95rem;
  
  &::placeholder {
    color: rgba(255, 255, 255, 0.3);
    font-weight: 300;
  }
  
  &:focus {
    outline: none;
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.password-toggle {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s;
  font-size: 18px;
  
  &:hover:not(:disabled) {
    color: white;
    background: rgba(255, 255, 255, 0.05);
  }
  
  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
}

.input-underline {
  position: absolute;
  bottom: -1px;
  left: 50%;
  width: 0;
  height: 2px;
  background: linear-gradient(90deg, #3b82f6, #8b5cf6);
  transition: all 0.3s;
  border-radius: 2px;
  
  .focused & {
    width: 100%;
    left: 0;
  }
}

.validation-icon {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 16px;
  animation: scaleIn 0.2s;
}

.field-error {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #f87171;
  font-size: 0.8rem;
  padding: 4px 8px;
  background: rgba(239, 68, 68, 0.1);
  border-radius: 6px;
  
  .error-icon {
    font-size: 12px;
  }
}

/* Checkbox personnalisée */
.remember-group {
  margin-top: 8px;
}

.checkbox-container {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}

.checkbox-input {
  position: absolute;
  opacity: 0;
  cursor: pointer;
  height: 0;
  width: 0;
}

.checkbox-custom {
  position: relative;
  display: inline-block;
  width: 18px;
  height: 18px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  transition: all 0.2s;
  
  .checkbox-input:checked + & {
    background: #3b82f6;
    border-color: #3b82f6;
    
    &::after {
      content: '✓';
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      color: white;
      font-size: 12px;
    }
  }
  
  .checkbox-input:focus + & {
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
  }
  
  .checkbox-input:disabled + & {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.checkbox-label {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.9rem;
}

/* Bouton de soumission */
.submit-button {
  position: relative;
  height: 52px;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  border: none;
  border-radius: 12px;
  color: white;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s;
  margin-top: 8px;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
    transition: left 0.5s;
  }
  
  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 10px 20px -5px rgba(59, 130, 246, 0.4);
    
    &::before {
      left: 100%;
    }
  }
  
  &:active:not(:disabled) {
    transform: translateY(0);
  }
  
  &.disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  &.loading {
    cursor: wait;
    background: linear-gradient(135deg, #4b5563 0%, #374151 100%);
    
    &::before {
      display: none;
    }
  }
}

.loading-spinner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  
  .spinner {
    width: 20px;
    height: 20px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
}

/* Message d'erreur */
.error-message {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 10px;
  color: #fecaca;
  font-size: 0.9rem;
  animation: shake 0.5s;
  
  .error-icon {
    font-size: 16px;
  }
  
  .error-text {
    flex: 1;
  }
  
  .error-close {
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.5);
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    transition: all 0.2s;
    
    &:hover {
      color: white;
      background: rgba(255, 255, 255, 0.1);
    }
  }
}

/* Support */
.support-section {
  margin-top: 16px;
  text-align: center;
}

.support-text {
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.85rem;
}

.support-link {
  background: none;
  border: none;
  color: #60a5fa;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s;
  
  &:hover:not(:disabled) {
    background: rgba(96, 165, 250, 0.1);
    color: #93c5fd;
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

/* Animations */
@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes scaleIn {
  from {
    opacity: 0;
    transform: translateY(-50%) scale(0.8);
  }
  to {
    opacity: 1;
    transform: translateY(-50%) scale(1);
  }
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
  20%, 40%, 60%, 80% { transform: translateX(5px); }
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-fade-enter-active {
  transition: all 0.3s ease;
}

.slide-fade-leave-active {
  transition: all 0.3s cubic-bezier(1, 0.5, 0.8, 1);
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  transform: translateY(-10px);
  opacity: 0;
}

.shake-enter-active {
  animation: shake 0.5s;
}
</style>