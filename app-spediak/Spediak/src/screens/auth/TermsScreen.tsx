import React from 'react';
import { ScrollView, Text, StyleSheet, View, TouchableOpacity, SafeAreaView, Platform } from 'react-native';
import { COLORS } from '../../styles/colors'; // Adjust path if needed
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/AuthNavigator'; // Adjust path if needed
import { Ionicons } from '@expo/vector-icons';

// Paste your full, formatted terms and conditions text here.
// For long text, consider breaking it into an array of paragraphs or sections.
const TERMS_AND_CONDITIONS_TEXT = `
Spediak, LLC Inspection App Terms of Use & Privacy Agreement

This Terms of Use and Privacy Agreement (“Agreement”) outlines the conditions under which you may access and use the Spediak Inspection App. It also describes how we collect, use, and safeguard your personal data. By continuing to use the App, you acknowledge and accept the terms in this Agreement.

**1. Acceptance of Terms**

By registering for and using the Spediak Inspection App ("App"), you expressly agree to comply with and be bound by these Terms of Use and Privacy Agreement ("Agreement"). It is important that you carefully read and fully understand these terms before using the App.

**2. Data Collection and Privacy**

Spediak, LLC ("we", "our", "us") collects the following types of information:

*   **Personal Information:** Name, email address, and contact information.
*   **Demographic Data:** Information about user demographics to enhance user experience.
*   **Images and Defects:** Photos uploaded through the App for defect identification and analysis. These images are automatically analyzed by artificial intelligence (AI) systems to enhance the App's capabilities and improve both the product and overall user experience.
    *   **Important:** We do not collect or store any specific location information or address data. Users are advised not to upload images that include identifiable locations, addresses, individuals, or any confidential or private information they would not want collected or shared.
*   **Comments:** If you leave comments, we collect data shown in the comments form, along with your IP address and browser user agent string to assist in spam detection. An anonymized string created from your email address (also called a hash) may be provided to the Gravatar service. The Gravatar service privacy policy is available at: https://automattic.com/privacy/. After approval of your comment, your profile picture may be visible to the public alongside your comment.

We collect email and contact information specifically to:

*   Communicate important App updates, policy changes, and service announcements.
*   Provide personalized user experiences.
*   Enhance customer support and efficiently respond to user inquiries.
*   Conduct research and development to enhance the quality, accuracy, and functionality of the App.
*   Facilitate communication regarding promotional opportunities and updates directly related to our services.

**3. Non-disclosure and Data Security**

Spediak, LLC does not sell, lease, or rent personal or demographic data to third parties. All collected information, including anonymized data such as hashed email addresses used for services like Gravatar, is strictly used internally for research, development, spam detection, and App improvement purposes. We employ industry-standard security practices to safeguard your information and ensure that anonymized data is handled securely and confidentially.

## Spediak Inspection App

### Terms of Use & Privacy Agreement

**Effective Date:** May 9, 2025

---

### 1. Acceptance of Terms

By registering for and using the Spediak Inspection App (the “App”), you agree to these Terms of Use & Privacy Agreement (the “Agreement”). Please read them carefully before using the App.

### 2. Information We Collect

We collect data to improve your experience and enhance App functionality. The types of information we gather include:

* **Personal Information:** Name, email address, and contact details.
* **Demographic Data:** User demographics to personalize the experience.
* **Images & Defect Data:** Photos you upload for AI-driven defect analysis.

  * *Note:* We do not collect or store location or address information. Avoid uploading images containing identifiable locations, addresses, individuals, or confidential data.
* **Comments:** Content you submit in comments, along with IP address and browser user agent. An anonymized hash of your email may be shared with Gravatar; see their [Privacy Policy](https://automattic.com/privacy/).

We use your information to:

1. Send important App updates and announcements.
2. Provide personalized experiences and customer support.
3. Conduct research and development.
4. Communicate promotional opportunities related to our services.

### 3. Data Security & Non‑Disclosure

* We do **not** sell, lease, or rent personal or demographic data to third parties.
* All data, including anonymized hashes, is used internally for App improvement, spam detection, and research.
* We implement industry-standard security measures to protect your data.

### 4. Media Uploads

When uploading images:

* Remove EXIF GPS/location data before uploading.
* All images are analyzed by automated AI systems; manual review occurs only for debugging or feature enhancements.
* Do not upload sensitive or confidential images.

### 5. Cookies

We may use cookies to:

* Save your comment form details for one year (optional).
* Manage login sessions (temporary cookies last up to two days; “Remember Me” keeps you signed in for two weeks).
* Store screen display preferences for up to one year.

### 6. Embedded & Third‑Party Content

* The App may display embedded content (videos, images, etc.) from external sites, which may collect data or use cookies.
* We are not responsible for their privacy practices. Please review their policies.

### 7. Data Retention

* **Comments & Metadata:** Retained indefinitely for spam detection and comment threading.
* **User Profiles:** Your personal information remains in your profile and can be viewed, edited, or deleted (except your username).

### 8. Your Data Rights

You may:

* Request an export of your personal data.
* Request deletion of your personal data (note: deleting your account data prevents further App access).

### 9. Data Sharing

* Password reset emails may include your IP address.
* Comments may be checked by automated spam-detection services.

### 10. User Responsibility & AI Disclaimers

* The App’s AI features are **supplementary** and provided “as-is.”
* You assume all responsibility for verifying AI-generated reports.
* AI results are not a substitute for professional inspections or certifications.

### 11. Changes to This Agreement

We may update these terms at any time. New terms take effect upon posting. Continued use of the App constitutes acceptance of the changes.

### 12. Termination

We may suspend or terminate your access without notice for violations of this Agreement or harmful conduct.

### 13. Governing Law

This Agreement is governed by the laws of North Carolina, without regard to conflict of laws principles.

### 14. Indemnification

You agree to defend and hold harmless Spediak, LLC and its affiliates from any claims, damages, or expenses arising from your use of the App or violation of this Agreement.

### 15. Children’s Privacy

Our services are not directed at children under 13. If we discover we’ve collected data from someone under 13, we will remove it promptly.

### 16. General Provisions

* The App is provided “as-is” and “as-available.”
* We do not guarantee uninterrupted access or error-free operation.
* See Section 18 (Limitation of Liability) for disclaimers.

### 17. AI Usage & Protections

* The App uses AI technology; AI-generated results are algorithmic and should be reviewed, interpreted, and confirmed by you.

### 18. Limitation of Liability

To the fullest extent allowed by law, Spediak, LLC is not liable for any indirect or consequential damages arising from your use of the App.


**Contact:** For any questions, email us at support@spediak.com


Effective Date: This Agreement was last updated on May 9, 2025.
`;

// For a better display of Markdown-like text, you could use react-native-markdown-display
// For simplicity here, we'll use basic Text rendering. You can enhance this.

type TermsScreenProps = NativeStackScreenProps<AuthStackParamList, 'TermsAndConditions'>;

const TermsScreen: React.FC<TermsScreenProps> = ({ navigation }) => {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={28} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms & Conditions</Text>
        <View style={{ width: 28 }} /> {/* Placeholder for balance */}
      </View>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        {/* Consider splitting text by \n\n and rendering <Text> for each paragraph */}
        {/* Or using a Markdown renderer for better formatting of bold, bullets etc. */}
        <Text style={styles.termsText}>{TERMS_AND_CONDITIONS_TEXT}</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.secondary,
    backgroundColor: COLORS.white,
    paddingTop: Platform.OS === 'android' ? 25 : 10, // Adjust for status bar
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.darkText,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  termsText: {
    fontSize: 14,
    lineHeight: 22,
    color: COLORS.darkText,
  },
});

export default TermsScreen; 