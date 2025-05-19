import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../styles/colors';

// Paste your full, formatted privacy policy text here.
const PRIVACY_POLICY_TEXT = `
Spediak LLC, Privacy Policy
Effective Date: May 16, 2025
Version: 2.3 – Last Updated May 16, 2025

1. Introduction
This Privacy Policy explains how Spediak, LLC ("we," "our," "us") collects, uses, and protects your data when you use the Spediak Inspection App ("App"). By using the App, you agree to the terms of this Policy.

2. Information We Collect
Personal Information

Name, email, and contact details

Demographic Data

Used to enhance the user experience

Uploaded Images

Processed by automated AI systems for defect identification and analysis

Manual review is limited and performed under strict access control for:

System maintenance

Debugging

Feature improvement

Important: Do not upload images containing identifiable individuals, GPS/location data, or sensitive/confidential content.

Disclaimer: Spediak, LLC is not responsible for any consequences arising from the upload of such data.

Comments

We collect:

Form data

IP address

Browser user agent string (for spam detection)

An anonymized email hash may be shared with Gravatar (see their policy at: automattic.com/privacy)

Profile picture may appear with approved comments

3. How We Use Your Information
Operate and improve the App

Communicate service updates and changes

Provide customer support

Personalize the user experience

Conduct R&D and AI model improvement

Send relevant promotional communications

Notify users of opportunities or important updates

Train AI systems (with data anonymization safeguards)

4. AI Training Use
By uploading content, you grant us a non-exclusive, royalty-free license to use anonymized data for:

Improving services

Training AI models

You may request to opt out by contacting: support@spediak.com

5. Data Security
We use industry-standard security practices:

Encryption in transit and at rest

Strict access controls

Annual security assessments

6. Data Sharing
We do not sell or rent your data.

Data may be processed by trusted third-party vendors under confidentiality agreements

International Transfers:

Primary servers are in the U.S.

Transfers to other jurisdictions (EU, Canada, Asia-Pacific) may occur

Protected by standard contractual clauses

Your continued use implies consent

7. Media Uploads
Avoid uploading images with EXIF GPS/location data

AI analyzes images for improvement purposes

Manual reviews are limited, confidential, and used only for debugging or system upkeep

8. Cookies and Tracking
Login and comment cookies: session-based

Analytics cookies: may persist longer

You can manage cookies in your browser settings

Disabling cookies may affect app functionality

9. Data Retention
Comments and metadata: retained indefinitely

User profile data: retained until user deletes or required by law

Users may request:

Data deletion

Correction

Export

10. Your Rights
Depending on your jurisdiction, you may:

Access your personal data

Request correction or deletion

Restrict or object to processing

Request data portability

Withdraw consent (if applicable)

To exercise rights, contact: support@spediak.com
Verification of identity may be required.

Parents: If we’ve collected information from a child under 13, please contact us to delete it.

11. Children’s Privacy
App not intended for users under 13

We do not knowingly collect their data

Parents can request removal of such data if inadvertently collected

12. Data Breach Protocol
Data is encrypted and secured with access controls

In the event of a breach, users will be notified promptly per applicable law

Immediate steps will be taken to mitigate harm

13. User Responsibility & AI Limitations
The App uses AI to assist with defect identification

Results are algorithmically generated and not guaranteed to be accurate

Users are responsible for verifying information independently

The App is not a substitute for a licensed inspector or contractor

14. Embedded Content & Third-Party Services
Embedded third-party content may collect data independently

Interact with such content at your own risk

We are not responsible for third-party practices

15. Modifications to This Policy
We may update this Policy occasionally

Material changes will be communicated (via email or in-app)

Continued use after updates means you accept the changes

16. Contact Information
For questions or data rights requests:

📧 Email: support@spediak.com

17. Additional Legal Terms
For topics such as:

Indemnification

Limitation of liability

Governing law

Please refer to the Spediak, LLC Inspection App Terms of Use
`;

const PrivacyPolicyScreen: React.FC = () => {
    const navigation = useNavigation();

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Privacy Policy</Text>
            </View>
            <ScrollView 
                style={styles.scrollView} 
                contentContainerStyle={styles.scrollContainer}
            >
                <Text style={styles.policyText}>{PRIVACY_POLICY_TEXT}</Text>
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
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.secondary,
        backgroundColor: COLORS.white,
    },
    backButton: {
        marginRight: 15,
        padding: 5,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.darkText,
    },
    scrollView: {
        flex: 1,
    },
    scrollContainer: {
        padding: 20,
    },
    policyText: {
        fontSize: 14,
        lineHeight: 22,
        color: COLORS.darkText,
    },
});

export default PrivacyPolicyScreen; 