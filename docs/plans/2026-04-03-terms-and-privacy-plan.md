# Terms of Service & Privacy Policy Pages — Implementation Plan

> **For implementation:** Use the secure-feature-pipeline skill, step: implement

**Goal:** Add two public static pages (Terms of Service + Privacy Policy) accessible from the landing footer, auth pages, and settings hub — no backend changes required.
**Spec:** `docs/specs/2026-04-03-terms-and-privacy-spec.md`
**Architecture:** Pure frontend — two new Next.js static pages under `app/[locale]/legal/`, following the existing `/guide` page pattern. Uses `LandingNavbar` + `LandingFooter`, `OrnateHeading`, `OrnateDivider`. Content is inline static text (no CMS, no API).
**Tech Stack:** Next.js 16 App Router, next-intl v4, TypeScript, Tailwind CSS v2-tokens

---

## Security Implementation Notes

- **Authentication:** None required — pages are fully public (`robots: index, follow`)
- **Authorization:** No resource ownership checks — same content for all visitors
- **Input validation:** N/A — read-only static pages, zero user input
- **Data sanitization:** N/A — no dynamic data rendered, no user-supplied content
- **XSS:** Not applicable — no dangerouslySetInnerHTML, no external content injection

---

## Component Reuse Inventory

**Existing components to reuse:**

| Component | Location | Usage in This Feature |
|-----------|----------|-----------------------|
| `LandingNavbar` | `components/landing/LandingNavbar.tsx` | Top navigation on legal pages (same as guide page) |
| `LandingFooter` | `components/landing/LandingFooter.tsx` | Footer on legal pages + add ToS/Privacy links here |
| `OrnateHeading` | `components/decorative/` | Section headings on legal pages |
| `OrnateDivider` | `components/decorative/` | Visual dividers between sections |
| `Link` (Next.js) | next/link | All navigation links |

**New components needed:**

| Component | Location | Justification |
|-----------|----------|---------------|
| `TermsContent.tsx` | `app/[locale]/legal/terms/TermsContent.tsx` | Co-located static content — unique to this page, not reusable |
| `PrivacyContent.tsx` | `app/[locale]/legal/privacy/PrivacyContent.tsx` | Co-located static content — unique to this page, not reusable |

---

## C4 Architecture Diagram Updates

Per spec: Update `docs/architecture/c4-component-frontend.md` — add `TermsPage` and `PrivacyPolicyPage` as new public page nodes. No new feature module.

---

## Runtime Flow Diagrams

Per spec: No flow diagrams needed — simple static navigation, no multi-step logic, no API calls.

---

## Task Order

```
Task 0:  Register `legal` i18n namespace
Task 1:  Create messages/en/legal.json + messages/vi/legal.json
Task 2:  Create app/[locale]/legal/layout.tsx (shared metadata shell)
Task 3:  Create Terms of Service page (layout + page + TermsContent)
Task 4:  Create Privacy Policy page (layout + page + PrivacyContent)
Task 5:  Fix auth page broken links (login + register)
Task 6:  Update LandingFooter — add ToS/Privacy links
Task 7:  Update Settings Hub — add Legal section
Task 8:  Update C4 frontend diagram
```

Tasks 3 and 4 can run in parallel (independent files). Tasks 5, 6, 7 can run in parallel after Task 1.

---

## Task 0: Register `legal` i18n Namespace

**Files:**
- Modify: `src/wj-client/i18n/request.ts`

**Why:** next-intl requires all namespaces to be registered in `i18n/request.ts`. Without this, `useTranslations("legal")` / `getTranslations("legal")` will fail at runtime.

**Steps:**

1. Read `src/wj-client/i18n/request.ts` to see current namespace list
2. Add `"legal"` to the messages loading configuration
3. Verify it follows the same pattern as existing namespaces (e.g., `"guide"`, `"settings"`)

**No test needed** — this is a config change verified by the app compiling and translations loading correctly.

---

## Task 1: Create i18n Message Files

**Files:**
- Create: `src/wj-client/messages/en/legal.json`
- Create: `src/wj-client/messages/vi/legal.json`

**Steps:**

**Step 1: Create `messages/en/legal.json`**

```json
{
  "terms": {
    "title": "Terms of Service",
    "subtitle": "Please read these terms carefully before using WealthJourney.",
    "lastUpdated": "Last updated: April 2026",
    "sections": {
      "introduction": {
        "title": "1. Introduction",
        "content": "Welcome to WealthJourney (\"the Service\"), operated by congdongvang.com. By accessing or using the Service, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service."
      },
      "acceptance": {
        "title": "2. Acceptance of Terms",
        "content": "By creating an account or using the Service in any way, you confirm that you are at least 18 years old, that you have read and understood these Terms, and that you agree to be bound by them."
      },
      "userResponsibilities": {
        "title": "3. User Responsibilities",
        "content": "You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to provide accurate and complete information when registering and to keep your information up to date."
      },
      "disclaimer": {
        "title": "4. Disclaimer of Liability — Investments & Financial Decisions",
        "content": "WealthJourney is a personal finance tracking tool only. The Service does not provide financial advice, investment recommendations, or any form of financial guidance. All investment decisions, trading activities, and financial actions you take are solely your own responsibility. The Service is not liable for any financial losses, damages, or adverse outcomes you may experience as a result of using information displayed within the application. Past performance of any investment is not indicative of future results. You should consult a qualified financial advisor before making any investment decisions."
      },
      "intellectualProperty": {
        "title": "5. Intellectual Property",
        "content": "All content, features, and functionality of the Service — including but not limited to text, graphics, logos, and software — are the exclusive property of congdongvang.com and are protected by applicable intellectual property laws."
      },
      "termination": {
        "title": "6. Termination",
        "content": "We reserve the right to suspend or terminate your access to the Service at any time, with or without cause, with or without notice. Upon termination, your right to use the Service will immediately cease."
      },
      "changes": {
        "title": "7. Changes to Terms",
        "content": "We may update these Terms from time to time. We will notify you of significant changes by updating the \"Last updated\" date. Your continued use of the Service after changes constitutes your acceptance of the new Terms."
      },
      "governingLaw": {
        "title": "8. Governing Law",
        "content": "These Terms are governed by the laws of Vietnam. Any disputes arising from these Terms or your use of the Service shall be subject to the exclusive jurisdiction of the courts of Vietnam."
      },
      "contact": {
        "title": "9. Contact Us",
        "content": "If you have any questions about these Terms of Service, please contact us through the app's feedback feature or at the contact information provided on our website."
      }
    }
  },
  "privacy": {
    "title": "Privacy Policy",
    "subtitle": "Your privacy is important to us. This policy explains how we collect, use, and protect your data.",
    "lastUpdated": "Last updated: April 2026",
    "sections": {
      "introduction": {
        "title": "1. Introduction",
        "content": "WealthJourney (\"we\", \"our\", or \"the Service\") is committed to protecting your privacy. This Privacy Policy explains what information we collect, how we use it, and your rights regarding your personal data."
      },
      "dataCollection": {
        "title": "2. Information We Collect",
        "content": "We collect information you provide directly: account details (name, email), financial data you enter (wallets, transactions, investments, budgets), and usage data (login activity, session information). We do not collect payment card information."
      },
      "dataUse": {
        "title": "3. How We Use Your Information",
        "content": "We use your information to provide and improve the Service, authenticate your identity, display your financial data within the app, send important service notifications, and analyze aggregate usage patterns to improve features. We do not sell your personal data to third parties."
      },
      "dataStorage": {
        "title": "4. Data Storage & Security",
        "content": "Your data is stored in PostgreSQL databases hosted on Supabase and cached in Redis. All data is transmitted over HTTPS/TLS. Authentication tokens (JWT) are stored in your browser's localStorage under the key defined by the application. We implement industry-standard security measures, but no method of transmission or storage is 100% secure."
      },
      "thirdParties": {
        "title": "5. Third-Party Services",
        "content": "We use the following third-party services: Google OAuth (for account authentication — subject to Google's Privacy Policy), Supabase (database and storage hosting), and market data providers for investment price information. Each provider has their own privacy policy governing how they handle data."
      },
      "userRights": {
        "title": "6. Your Rights",
        "content": "You have the right to access, correct, or delete your personal data at any time. You can export your transaction data via the app's export feature. To request full account deletion, use the settings page or contact us directly. We will process deletion requests within 30 days."
      },
      "cookies": {
        "title": "7. Cookies & Local Storage",
        "content": "We use browser localStorage to store your authentication token (JWT) and user preferences. We do not use third-party tracking cookies. You can clear your localStorage at any time through your browser settings, which will log you out of the Service."
      },
      "changes": {
        "title": "8. Changes to This Policy",
        "content": "We may update this Privacy Policy periodically. We will notify you of significant changes by updating the \"Last updated\" date. Continued use of the Service after changes constitutes acceptance of the updated policy."
      },
      "contact": {
        "title": "9. Contact Us",
        "content": "For privacy-related inquiries, data access requests, or to exercise your rights, please contact us through the app's feedback feature or at the contact information provided on our website."
      }
    }
  }
}
```

**Step 2: Create `messages/vi/legal.json`** (Vietnamese translation — same structure):

```json
{
  "terms": {
    "title": "Điều khoản dịch vụ",
    "subtitle": "Vui lòng đọc kỹ các điều khoản này trước khi sử dụng WealthJourney.",
    "lastUpdated": "Cập nhật lần cuối: Tháng 4 năm 2026",
    "sections": {
      "introduction": {
        "title": "1. Giới thiệu",
        "content": "Chào mừng bạn đến với WealthJourney (\"Dịch vụ\"), được vận hành bởi congdongvang.com. Bằng cách truy cập hoặc sử dụng Dịch vụ, bạn đồng ý bị ràng buộc bởi các Điều khoản Dịch vụ này. Nếu bạn không đồng ý với các điều khoản này, vui lòng không sử dụng Dịch vụ."
      },
      "acceptance": {
        "title": "2. Chấp nhận điều khoản",
        "content": "Bằng cách tạo tài khoản hoặc sử dụng Dịch vụ theo bất kỳ cách nào, bạn xác nhận rằng bạn ít nhất 18 tuổi, đã đọc và hiểu các Điều khoản này, và đồng ý bị ràng buộc bởi chúng."
      },
      "userResponsibilities": {
        "title": "3. Trách nhiệm của người dùng",
        "content": "Bạn có trách nhiệm bảo mật thông tin đăng nhập tài khoản và chịu trách nhiệm về mọi hoạt động xảy ra dưới tài khoản của bạn. Bạn đồng ý cung cấp thông tin chính xác và đầy đủ khi đăng ký và cập nhật thông tin kịp thời."
      },
      "disclaimer": {
        "title": "4. Tuyên bố miễn trừ trách nhiệm — Đầu tư & Quyết định tài chính",
        "content": "WealthJourney chỉ là công cụ theo dõi tài chính cá nhân. Dịch vụ không cung cấp tư vấn tài chính, khuyến nghị đầu tư, hay bất kỳ hướng dẫn tài chính nào. Mọi quyết định đầu tư, hoạt động giao dịch và hành động tài chính bạn thực hiện đều hoàn toàn là trách nhiệm của bạn. Dịch vụ không chịu trách nhiệm về bất kỳ tổn thất tài chính, thiệt hại hoặc kết quả bất lợi nào bạn có thể gặp phải do sử dụng thông tin hiển thị trong ứng dụng. Kết quả hoạt động trong quá khứ không đảm bảo cho kết quả trong tương lai. Bạn nên tham khảo ý kiến của chuyên gia tài chính có chuyên môn trước khi đưa ra quyết định đầu tư."
      },
      "intellectualProperty": {
        "title": "5. Quyền sở hữu trí tuệ",
        "content": "Tất cả nội dung, tính năng và chức năng của Dịch vụ — bao gồm nhưng không giới hạn ở văn bản, đồ họa, logo và phần mềm — là tài sản độc quyền của congdongvang.com và được bảo vệ theo luật sở hữu trí tuệ hiện hành."
      },
      "termination": {
        "title": "6. Chấm dứt",
        "content": "Chúng tôi có quyền đình chỉ hoặc chấm dứt quyền truy cập của bạn vào Dịch vụ bất cứ lúc nào, có hoặc không có lý do, có hoặc không có thông báo. Khi chấm dứt, quyền sử dụng Dịch vụ của bạn sẽ lập tức chấm dứt."
      },
      "changes": {
        "title": "7. Thay đổi điều khoản",
        "content": "Chúng tôi có thể cập nhật các Điều khoản này theo thời gian. Chúng tôi sẽ thông báo về những thay đổi quan trọng bằng cách cập nhật ngày \"Cập nhật lần cuối\". Việc tiếp tục sử dụng Dịch vụ sau khi có thay đổi đồng nghĩa với việc bạn chấp nhận các Điều khoản mới."
      },
      "governingLaw": {
        "title": "8. Luật áp dụng",
        "content": "Các Điều khoản này được điều chỉnh bởi pháp luật Việt Nam. Mọi tranh chấp phát sinh từ các Điều khoản này hoặc việc bạn sử dụng Dịch vụ sẽ thuộc thẩm quyền xét xử độc quyền của tòa án Việt Nam."
      },
      "contact": {
        "title": "9. Liên hệ",
        "content": "Nếu bạn có câu hỏi về Điều khoản Dịch vụ này, vui lòng liên hệ chúng tôi qua tính năng phản hồi trong ứng dụng hoặc tại thông tin liên hệ trên trang web của chúng tôi."
      }
    }
  },
  "privacy": {
    "title": "Chính sách bảo mật",
    "subtitle": "Quyền riêng tư của bạn rất quan trọng với chúng tôi. Chính sách này giải thích cách chúng tôi thu thập, sử dụng và bảo vệ dữ liệu của bạn.",
    "lastUpdated": "Cập nhật lần cuối: Tháng 4 năm 2026",
    "sections": {
      "introduction": {
        "title": "1. Giới thiệu",
        "content": "WealthJourney (\"chúng tôi\") cam kết bảo vệ quyền riêng tư của bạn. Chính sách Bảo mật này giải thích những thông tin chúng tôi thu thập, cách chúng tôi sử dụng và quyền của bạn đối với dữ liệu cá nhân."
      },
      "dataCollection": {
        "title": "2. Thông tin chúng tôi thu thập",
        "content": "Chúng tôi thu thập thông tin bạn cung cấp trực tiếp: thông tin tài khoản (tên, email), dữ liệu tài chính bạn nhập (ví, giao dịch, đầu tư, ngân sách) và dữ liệu sử dụng (hoạt động đăng nhập, thông tin phiên). Chúng tôi không thu thập thông tin thẻ thanh toán."
      },
      "dataUse": {
        "title": "3. Cách chúng tôi sử dụng thông tin",
        "content": "Chúng tôi sử dụng thông tin của bạn để cung cấp và cải thiện Dịch vụ, xác thực danh tính, hiển thị dữ liệu tài chính trong ứng dụng, gửi thông báo dịch vụ quan trọng và phân tích mẫu sử dụng tổng hợp để cải thiện tính năng. Chúng tôi không bán dữ liệu cá nhân của bạn cho bên thứ ba."
      },
      "dataStorage": {
        "title": "4. Lưu trữ & Bảo mật dữ liệu",
        "content": "Dữ liệu của bạn được lưu trữ trong cơ sở dữ liệu PostgreSQL được lưu trữ trên Supabase và được lưu cache trong Redis. Tất cả dữ liệu được truyền qua HTTPS/TLS. Token xác thực (JWT) được lưu trong localStorage của trình duyệt. Chúng tôi áp dụng các biện pháp bảo mật tiêu chuẩn ngành, nhưng không có phương thức truyền tải hay lưu trữ nào an toàn 100%."
      },
      "thirdParties": {
        "title": "5. Dịch vụ bên thứ ba",
        "content": "Chúng tôi sử dụng các dịch vụ bên thứ ba sau: Google OAuth (để xác thực tài khoản — tuân theo Chính sách Bảo mật của Google), Supabase (lưu trữ cơ sở dữ liệu) và các nhà cung cấp dữ liệu thị trường để lấy thông tin giá đầu tư. Mỗi nhà cung cấp có chính sách bảo mật riêng."
      },
      "userRights": {
        "title": "6. Quyền của bạn",
        "content": "Bạn có quyền truy cập, chỉnh sửa hoặc xóa dữ liệu cá nhân của mình bất cứ lúc nào. Bạn có thể xuất dữ liệu giao dịch qua tính năng xuất của ứng dụng. Để yêu cầu xóa tài khoản hoàn toàn, sử dụng trang cài đặt hoặc liên hệ trực tiếp với chúng tôi. Chúng tôi sẽ xử lý yêu cầu xóa trong vòng 30 ngày."
      },
      "cookies": {
        "title": "7. Cookie & Local Storage",
        "content": "Chúng tôi sử dụng localStorage của trình duyệt để lưu trữ token xác thực (JWT) và tùy chọn người dùng. Chúng tôi không sử dụng cookie theo dõi của bên thứ ba. Bạn có thể xóa localStorage bất cứ lúc nào qua cài đặt trình duyệt, điều này sẽ đăng xuất bạn khỏi Dịch vụ."
      },
      "changes": {
        "title": "8. Thay đổi chính sách",
        "content": "Chúng tôi có thể cập nhật Chính sách Bảo mật này định kỳ. Chúng tôi sẽ thông báo về những thay đổi quan trọng bằng cách cập nhật ngày \"Cập nhật lần cuối\". Việc tiếp tục sử dụng Dịch vụ sau khi có thay đổi đồng nghĩa với việc bạn chấp nhận chính sách đã cập nhật."
      },
      "contact": {
        "title": "9. Liên hệ",
        "content": "Để biết thêm về quyền riêng tư, yêu cầu truy cập dữ liệu hoặc thực hiện quyền của bạn, vui lòng liên hệ chúng tôi qua tính năng phản hồi trong ứng dụng hoặc tại thông tin liên hệ trên trang web."
      }
    }
  }
}
```

**No unit test needed** — JSON config file. Verified by app compiling without i18n errors.

---

## Task 2: Create Shared Legal Layout

**Files:**
- Create: `src/wj-client/app/[locale]/legal/layout.tsx`

**Steps:**

**Step 1: Write failing test** — verify the layout renders children and metadata is set

```typescript
// src/wj-client/app/[locale]/legal/__tests__/layout.test.tsx
import { render } from "@testing-library/react";
import LegalLayout from "../layout";

test("renders children", () => {
  const { getByText } = render(
    <LegalLayout>{<div>child</div>}</LegalLayout>
  );
  expect(getByText("child")).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**
```bash
cd src/wj-client && npx jest app/[locale]/legal/__tests__/layout.test.tsx
```

**Step 3: Implement the layout**

```typescript
// src/wj-client/app/[locale]/legal/layout.tsx
import type { Metadata } from "next";
import { getLocale } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const baseUrl = "https://congdongvang.com";

  return {
    metadataBase: new URL(baseUrl),
    alternates: {
      canonical: `${baseUrl}/${locale}/legal`,
      languages: {
        vi: `${baseUrl}/vi/legal`,
        en: `${baseUrl}/en/legal`,
      },
    },
    robots: { index: true, follow: true },
  };
}

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
```

**Step 4: Run test to verify it passes**

---

## Task 3: Create Terms of Service Page

**Files:**
- Create: `src/wj-client/app/[locale]/legal/terms/page.tsx`
- Create: `src/wj-client/app/[locale]/legal/terms/layout.tsx`
- Create: `src/wj-client/app/[locale]/legal/terms/TermsContent.tsx`

**Security notes:** Static content only — no user input, no API calls, no auth required.

**Step 0: Component inventory check**
- Reusing: `LandingNavbar`, `LandingFooter`, `OrnateHeading`, `OrnateDivider` from existing components
- No new shared components needed

**Step 1: Write failing test**

```typescript
// src/wj-client/app/[locale]/legal/terms/__tests__/TermsContent.test.tsx
import { render, screen } from "@testing-library/react";

// Mock next-intl
jest.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));
// Mock LandingNavbar/Footer
jest.mock("@/components/landing/LandingNavbar", () => ({
  LandingNavbar: () => <nav data-testid="navbar" />,
}));
jest.mock("@/components/landing/LandingFooter", () => ({
  LandingFooter: () => <footer data-testid="footer" />,
}));

import { TermsContent } from "../TermsContent";

test("renders navbar and footer", () => {
  render(<TermsContent />);
  expect(screen.getByTestId("navbar")).toBeInTheDocument();
  expect(screen.getByTestId("footer")).toBeInTheDocument();
});

test("renders disclaimer section", () => {
  render(<TermsContent />);
  // Disclaimer section key is present
  expect(screen.getByText(/terms.sections.disclaimer.title/)).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**
```bash
cd src/wj-client && npx jest app/\\[locale\\]/legal/terms/__tests__/TermsContent.test.tsx
```

**Step 3: Implement**

```typescript
// src/wj-client/app/[locale]/legal/terms/layout.tsx
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("legal");
  const baseUrl = "https://congdongvang.com";

  return {
    title: `${t("terms.title")} | WealthJourney`,
    description: t("terms.subtitle"),
    metadataBase: new URL(baseUrl),
    alternates: {
      canonical: `${baseUrl}/${locale}/legal/terms`,
      languages: {
        vi: `${baseUrl}/vi/legal/terms`,
        en: `${baseUrl}/en/legal/terms`,
      },
    },
    openGraph: {
      title: `${t("terms.title")} | WealthJourney`,
      description: t("terms.subtitle"),
    },
    robots: { index: true, follow: true },
  };
}

export default function TermsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
```

```typescript
// src/wj-client/app/[locale]/legal/terms/page.tsx
import { TermsContent } from "./TermsContent";

export default function TermsPage() {
  return <TermsContent />;
}
```

```typescript
// src/wj-client/app/[locale]/legal/terms/TermsContent.tsx
"use client";

import { useTranslations } from "next-intl";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { OrnateHeading } from "@/components/decorative/OrnateHeading";
import { OrnateDivider } from "@/components/decorative/OrnateDivider";

const SECTIONS = [
  "introduction",
  "acceptance",
  "userResponsibilities",
  "disclaimer",
  "intellectualProperty",
  "termination",
  "changes",
  "governingLaw",
  "contact",
] as const;

export function TermsContent() {
  const t = useTranslations("legal");

  return (
    <div className="min-h-screen bg-v2-bg-primary">
      <LandingNavbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <OrnateHeading level={1} className="text-2xl sm:text-3xl font-bold text-v2-gold-accent mb-3">
            {t("terms.title")}
          </OrnateHeading>
          <p className="text-v2-text-tertiary text-sm">{t("terms.lastUpdated")}</p>
          <p className="text-v2-text-secondary mt-2 text-sm sm:text-base max-w-2xl mx-auto">
            {t("terms.subtitle")}
          </p>
        </div>

        <OrnateDivider className="my-8" />

        {/* Sections */}
        <div className="space-y-8">
          {SECTIONS.map((sectionKey) => (
            <section
              key={sectionKey}
              id={sectionKey}
              className={
                sectionKey === "disclaimer"
                  ? "border-l-4 border-v2-red-negative bg-v2-red-light/10 p-5 rounded-r-lg"
                  : ""
              }
            >
              <h2 className="text-lg sm:text-xl font-semibold text-v2-gold-accent mb-3">
                {t(`terms.sections.${sectionKey}.title`)}
              </h2>
              <p className="text-v2-text-secondary text-sm sm:text-base leading-relaxed">
                {t(`terms.sections.${sectionKey}.content`)}
              </p>
            </section>
          ))}
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
```

**Step 4: Run test to verify it passes**
```bash
cd src/wj-client && npx jest app/\\[locale\\]/legal/terms/__tests__/TermsContent.test.tsx
```

**Step 5: Responsive & accessibility check**
- Mobile (375px): single column, `px-4`, text readable
- Desktop: `max-w-4xl`, `sm:px-6`
- Disclaimer section: visually distinct with red left border
- Semantic HTML: `<main>`, `<section>`, `<h2>` hierarchy
- Direct imports only (no barrel files)

**Step 6: Commit**
```
feat(legal): add Terms of Service page at /legal/terms
```

---

## Task 4: Create Privacy Policy Page

**Files:**
- Create: `src/wj-client/app/[locale]/legal/privacy/page.tsx`
- Create: `src/wj-client/app/[locale]/legal/privacy/layout.tsx`
- Create: `src/wj-client/app/[locale]/legal/privacy/PrivacyContent.tsx`

**Security notes:** Same as Task 3 — static only.

**Step 0: Component inventory check**
- Reusing same components as Task 3

**Step 1: Write failing test**

```typescript
// src/wj-client/app/[locale]/legal/privacy/__tests__/PrivacyContent.test.tsx
jest.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
jest.mock("@/components/landing/LandingNavbar", () => ({ LandingNavbar: () => <nav data-testid="navbar" /> }));
jest.mock("@/components/landing/LandingFooter", () => ({ LandingFooter: () => <footer data-testid="footer" /> }));

import { render, screen } from "@testing-library/react";
import { PrivacyContent } from "../PrivacyContent";

test("renders navbar and footer", () => {
  render(<PrivacyContent />);
  expect(screen.getByTestId("navbar")).toBeInTheDocument();
  expect(screen.getByTestId("footer")).toBeInTheDocument();
});

test("renders data collection section", () => {
  render(<PrivacyContent />);
  expect(screen.getByText(/privacy.sections.dataCollection.title/)).toBeInTheDocument();
});
```

**Step 2: Run test to verify it fails**

**Step 3: Implement** (same pattern as Task 3, swapping terms → privacy sections)

```typescript
// layout.tsx — same pattern with privacy title/description
// page.tsx — renders <PrivacyContent />
// PrivacyContent.tsx — same structure, sections: introduction, dataCollection, dataUse, dataStorage, thirdParties, userRights, cookies, changes, contact
```

The `PrivacyContent` component follows the identical pattern as `TermsContent` with:
- `SECTIONS = ["introduction", "dataCollection", "dataUse", "dataStorage", "thirdParties", "userRights", "cookies", "changes", "contact"]`
- No special highlighted section (no disclaimer equivalent)
- `t("privacy.sections.${sectionKey}.title")` / `t("privacy.sections.${sectionKey}.content")`

**Step 4: Run test to verify it passes**

**Step 5: Responsive & accessibility check** (same as Task 3)

**Step 6: Commit**
```
feat(legal): add Privacy Policy page at /legal/privacy
```

---

## Task 5: Fix Auth Page Broken Links

**Files:**
- Modify: `src/wj-client/app/[locale]/auth/login/page.tsx`
- Modify: `src/wj-client/app/[locale]/auth/register/page.tsx`

**Security notes:** None — just fixing href strings.

**Step 1: Read the current link code in both files**

In `login/page.tsx`, find lines with `href="#terms"` and `href="#privacy"`.
In `register/page.tsx`, find the same.

**Step 2: Update the hrefs**

Change:
```typescript
href="#terms"   →   href="/legal/terms"
href="#privacy" →   href="/legal/privacy"
```

**Step 3: Verify by reading the changed lines**

**Step 4: Playwright E2E — verify links navigate correctly**
```bash
cd src/wj-client && npx playwright test tests/e2e/ --grep "terms\|privacy\|legal" --reporter=list
```
If no existing test covers this, add a minimal check to the auth E2E spec.

**Step 5: Commit**
```
fix(auth): fix broken Terms and Privacy links in login/register pages
```

---

## Task 6: Update LandingFooter — Add Legal Links

**Files:**
- Modify: `src/wj-client/components/landing/LandingFooter.tsx`

**Security notes:** None — static links.

**Step 1: Read LandingFooter.tsx** to identify where to add the links (after contact info section).

**Step 2: Add links** in the footer, using existing i18n keys:

```typescript
import Link from "next/link";
import { useTranslations } from "next-intl";

// Inside the component, after contact block:
const tNav = useTranslations("nav");

// Add to footer JSX:
<div className="flex gap-4 mt-4 text-xs text-amber-200/70">
  <Link
    href="/legal/terms"
    className="hover:text-v2-gold-accent transition-colors underline underline-offset-2"
  >
    {tNav("landing.footer.termsOfService")}
  </Link>
  <Link
    href="/legal/privacy"
    className="hover:text-v2-gold-accent transition-colors underline underline-offset-2"
  >
    {tNav("landing.footer.privacyPolicy")}
  </Link>
</div>
```

**Step 3: Check LandingFooter is already a "use client" component** (confirmed — it uses `useState`/`useEffect`). The `useTranslations` hook can be used directly.

**Step 4: Verify nav translation namespace is already imported** — check if `useTranslations("nav")` is used elsewhere in the component. If not, it's safe to add.

**Step 5: Playwright E2E check**
```bash
cd src/wj-client && npx playwright test tests/e2e/ --reporter=list
```

**Step 6: Commit**
```
feat(landing): add Terms of Service and Privacy Policy links to footer
```

---

## Task 7: Update Settings Hub — Add Legal Section

**Files:**
- Modify: `src/wj-client/app/[locale]/dashboard/settings/page.tsx`
- Modify: `src/wj-client/messages/en/settings.json` — add `legal` section keys
- Modify: `src/wj-client/messages/vi/settings.json` — add `legal` section keys

**Security notes:** None — authenticated page, links to public pages.

**Step 1: Read `settings/page.tsx`** to understand the existing card/link pattern.

**Step 2: Add translation keys to settings.json**

English:
```json
"legal": {
  "title": "Legal",
  "terms": "Terms of Service",
  "privacy": "Privacy Policy"
}
```

Vietnamese:
```json
"legal": {
  "title": "Pháp lý",
  "terms": "Điều khoản dịch vụ",
  "privacy": "Chính sách bảo mật"
}
```

**Step 3: Add Legal section to settings page** following the existing card/link pattern:

```typescript
// In the settings page JSX, add a new section after existing links:
<div className="mt-6">
  <h2 className="text-v2-text-tertiary text-xs font-semibold uppercase tracking-wider mb-3 px-1">
    {t("legal.title")}
  </h2>
  <div className="space-y-2">
    <Link href="/legal/terms" className="... (same class as existing setting links)">
      <ScaleIcon className="w-5 h-5" />
      <span>{t("legal.terms")}</span>
    </Link>
    <Link href="/legal/privacy" className="... (same class as existing setting links)">
      <ShieldCheckIcon className="w-5 h-5" />
      <span>{t("legal.privacy")}</span>
    </Link>
  </div>
</div>
```

Use `lucide-react` icons: `Scale` for ToS, `ShieldCheck` for Privacy.

**Step 4: Verify the settings page still renders existing links correctly**

**Step 5: Commit**
```
feat(settings): add Legal section with ToS and Privacy links to settings hub
```

---

## Task 8: Update C4 Frontend Architecture Diagram

**Files:**
- Modify: `docs/architecture/c4-component-frontend.md`

**Steps:**

1. Read `docs/architecture/c4-component-frontend.md` to find where public pages are listed
2. Add `TermsPage` and `PrivacyPolicyPage` as new page nodes in the public pages section
3. Reference `LandingNavbar` and `LandingFooter` as dependencies (same as guide page)
4. Commit:
```
docs(arch): add Terms and Privacy pages to C4 frontend component diagram
```

---

## Success Criteria

- [ ] `/legal/terms` renders ToS with all 9 sections including Disclaimer of Liability
- [ ] `/legal/privacy` renders Privacy Policy with all 9 sections
- [ ] Both pages accessible without authentication
- [ ] Both pages work in `vi` and `en` locales
- [ ] Auth login/register links navigate to correct pages (not `#terms`/`#privacy` anchors)
- [ ] Landing footer shows ToS and Privacy links
- [ ] Settings hub shows Legal section with both links
- [ ] `task ci:frontend` passes (lint + type check)
- [ ] No new `any` TypeScript usage
- [ ] All components use direct imports (no barrel files)
