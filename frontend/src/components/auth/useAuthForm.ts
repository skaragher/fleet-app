import { ref, reactive, computed, watch } from 'vue';
import type { FormField, ValidationRule } from '@/types/auth.types';


interface AuthFormState {
  email: FormField;
  password: FormField;
  remember: FormField<boolean>;
}


const VALIDATION_RULES = {
  email: [
    { type: 'required', message: "L'email est requis" },
    { type: 'email', message: "Format d'email invalide" },
    { type: 'maxLength', value: 100, message: "L'email ne doit pas dépasser 100 caractères" }
  ] as ValidationRule[],
  
  password: [
    { type: 'required', message: "Le mot de passe est requis" },
    { type: 'minLength', value: 6, message: "Le mot de passe doit contenir au moins 6 caractères" },
    { type: 'maxLength', value: 50, message: "Le mot de passe ne doit pas dépasser 50 caractères" }
  ] as ValidationRule[]
};


export function useAuthForm() {
  // ============ STATE ============
  const formState = reactive<AuthFormState>({
    email: {
      value: '',
      error: null,
      touched: false,
      focused: false,
      rules: VALIDATION_RULES.email
    },
    password: {
      value: '',
      error: null,
      touched: false,
      focused: false,
      rules: VALIDATION_RULES.password
    },
    remember: {
      value: false,
      error: null,
      touched: false,
      focused: false,
      rules: []
    }
  });

  const showPassword = ref<boolean>(false);
  const submitAttempted = ref<boolean>(false);

 
  const validateField = (field: FormField): string | null => {
    for (const rule of field.rules) {
      switch (rule.type) {
        case 'required':
          if (!field.value || (typeof field.value === 'string' && !field.value.trim())) {
            return rule.message;
          }
          break;
          
        case 'email':
          if (typeof field.value === 'string' && field.value) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(field.value.trim())) {
              return rule.message;
            }
          }
          break;
          
        case 'minLength':
          if (typeof field.value === 'string' && field.value.length < (rule.value as number)) {
            return rule.message;
          }
          break;
          
        case 'maxLength':
          if (typeof field.value === 'string' && field.value.length > (rule.value as number)) {
            return rule.message;
          }
          break;
          
        case 'pattern':
          if (typeof field.value === 'string' && field.value && rule.value instanceof RegExp) {
            if (!rule.value.test(field.value)) {
              return rule.message;
            }
          }
          break;
      }
    }
    return null;
  };

  /**
   * Valide tous les champs du formulaire
   */
  const validateForm = (): boolean => {
    submitAttempted.value = true;
    let isValid = true;
    
    (Object.keys(formState) as Array<keyof AuthFormState>).forEach((key) => {
      const field = formState[key];
      if (field.rules.length > 0) {
        const error = validateField(field);
        field.error = error;
        field.touched = true;
        if (error) isValid = false;
      }
    });

    return isValid;
  };

  /**
   * Marque un champ comme touché
   */
  const markAsTouched = (fieldName: keyof AuthFormState): void => {
    formState[fieldName].touched = true;
    formState[fieldName].error = validateField(formState[fieldName]);
  };

  /**
   * Marque tous les champs comme touchés
   */
  const markAllAsTouched = (): void => {
    (Object.keys(formState) as Array<keyof AuthFormState>).forEach((key) => {
      formState[key].touched = true;
      formState[key].error = validateField(formState[key]);
    });
  };

  /**
   * Réinitialise le formulaire
   */
  const resetForm = (): void => {
    formState.email.value = '';
    formState.email.error = null;
    formState.email.touched = false;
    formState.email.focused = false;
    
    formState.password.value = '';
    formState.password.error = null;
    formState.password.touched = false;
    formState.password.focused = false;
    
    formState.remember.value = false;
    
    showPassword.value = false;
    submitAttempted.value = false;
  };

  // ============ COMPUTED ============
  
  const isFormValid = computed<boolean>(() => {
    return !formState.email.error && 
           !formState.password.error && 
           formState.email.value.trim() !== '' && 
           formState.password.value.trim() !== '';
  });

  const emailError = computed<string | null>(() => 
    formState.email.touched ? formState.email.error : null
  );

  const passwordError = computed<string | null>(() => 
    formState.password.touched ? formState.password.error : null
  );

  const hasErrors = computed<boolean>(() => {
    return !!formState.email.error || !!formState.password.error;
  });

  // ============ WATCHERS ============
  
  // Validation en temps réel
  watch(
    () => [formState.email.value, formState.password.value],
    () => {
      if (formState.email.touched) {
        formState.email.error = validateField(formState.email);
      }
      if (formState.password.touched) {
        formState.password.error = validateField(formState.password);
      }
    }
  );

  // ============ UTILS ============
  
  const toggleShowPassword = (): void => {
    showPassword.value = !showPassword.value;
  };

  return {
    // State
    formState,
    showPassword,
    submitAttempted,
    
    // Computed
    isFormValid,
    emailError,
    passwordError,
    hasErrors,
    
    // Methods
    validateForm,
    markAsTouched,
    markAllAsTouched,
    resetForm,
    toggleShowPassword
  };
}