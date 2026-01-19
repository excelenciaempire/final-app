import { StyleSheet, Platform } from 'react-native';
import { COLORS } from './colors';

// Consistent typography
export const TYPOGRAPHY = {
  // Font family - use system fonts that look clean
  fontFamily: Platform.select({
    ios: 'System',
    android: 'Roboto',
    web: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  }),
  
  // Font weights
  regular: '400' as const,
  medium: '500' as const,
  semiBold: '600' as const,
  bold: '700' as const,
};

// Global reusable styles
export const globalStyles = StyleSheet.create({
  // ============ INPUTS ============
  inputContainer: {
    marginBottom: 16,
  },
  
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.textPrimary,
    minHeight: 48,
  },
  
  inputFocused: {
    borderColor: COLORS.primary,
    borderWidth: 1.5,
  },
  
  inputDisabled: {
    backgroundColor: '#F3F4F6',
    color: COLORS.textMuted,
  },
  
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 14,
    minHeight: 48,
  },
  
  inputIcon: {
    marginRight: 10,
  },
  
  inputText: {
    flex: 1,
    fontSize: 15,
    color: COLORS.textPrimary,
    paddingVertical: 12,
  },
  
  // ============ TEXTAREAS ============
  textarea: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.textPrimary,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  
  // ============ PICKERS / DROPDOWNS ============
  // Cross-browser compatible styles (Chrome, Safari, Firefox, mobile)
  pickerContainer: {
    marginBottom: 16,
  },
  
  pickerLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  
  pickerWrapper: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    overflow: 'hidden',
    minHeight: 48,
    justifyContent: 'center',
    // @ts-ignore - Web-specific CSS for Safari/Chrome/Firefox compatibility
    ...(Platform.OS === 'web' && {
      WebkitAppearance: 'none',
      MozAppearance: 'none',
      appearance: 'none',
    }),
  },
  
  picker: {
    height: 48,
    color: COLORS.textPrimary,
    paddingHorizontal: 10,
    // @ts-ignore - Web-specific CSS for cross-browser compatibility
    ...(Platform.OS === 'web' && {
      WebkitAppearance: 'none',
      MozAppearance: 'none',
      appearance: 'none',
      backgroundColor: 'transparent',
      border: 'none',
      outline: 'none',
      width: '100%',
      fontSize: 15,
      paddingRight: 30,
      cursor: 'pointer',
    }),
  },
  
  // ============ SEARCH INPUTS ============
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 14,
    minHeight: 48,
  },
  
  searchIcon: {
    marginRight: 10,
  },
  
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: COLORS.textPrimary,
    paddingVertical: 12,
  },
  
  // ============ BUTTONS ============
  buttonPrimary: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    minHeight: 48,
  },
  
  buttonPrimaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  
  buttonSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    minHeight: 48,
  },
  
  buttonSecondaryText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  
  buttonDisabled: {
    backgroundColor: '#E5E7EB',
    opacity: 0.7,
  },
  
  // ============ CARDS ============
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  
  cardSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  
  // ============ TYPOGRAPHY ============
  screenTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  
  bodyText: {
    fontSize: 15,
    color: COLORS.textPrimary,
    lineHeight: 22,
  },
  
  caption: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  
  // ============ CONTAINERS ============
  screenContainer: {
    flex: 1,
    backgroundColor: '#F5F7FA',
  },
  
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // ============ FORM GROUPS ============
  formGroup: {
    marginBottom: 20,
  },
  
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  
  formHalf: {
    flex: 1,
  },
  
  // ============ BADGES ============
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  
  badgePrimary: {
    backgroundColor: COLORS.primaryLight,
  },
  
  badgeSuccess: {
    backgroundColor: '#D1FAE5',
  },
  
  badgeWarning: {
    backgroundColor: '#FEF3C7',
  },
  
  badgeError: {
    backgroundColor: '#FEE2E2',
  },
  
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  
  // ============ DIVIDERS ============
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 16,
  },
  
  // ============ LISTS ============
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  
  listItemText: {
    flex: 1,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  
  // ============ ERRORS ============
  errorText: {
    color: COLORS.error,
    fontSize: 13,
    marginTop: 4,
  },
  
  successText: {
    color: COLORS.success,
    fontSize: 13,
    marginTop: 4,
  },
});

export default globalStyles;

