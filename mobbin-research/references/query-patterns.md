# Mobbin 查询词构造指南

> 本文档教 agent 把"抽象产品目标"翻译成 Mobbin 搜索能理解的**可见画面语言**。搜索接口是自然语言语义匹配（见 capabilities.md），它理解"屏幕上有什么"，不理解 UX 理论。规划查询词时按需查阅本节与示例库。

## 核心规则：写画面，不写概念

搜索前把用户目标拆成"用户在这张屏/这段流程里**看到什么、做什么**"，再写成查询词。判断标准：一个没见过该产品的人，读查询词能想象出屏幕上的元素。

风格词和 UX 理论词（"modern login"、"trust patterns"、"smooth checkout"）匹配不到画面，要把它们翻译成屏幕上看得见的元素：

- "signup screen with progress indicator, phone number input, security message, and continue button"
- "bank transfer pending screen showing amount, recipient, estimated arrival time, and progress indicator"
- "dashboard empty state with illustration, explanatory text, and primary call to action"
- "login screen with email and password fields and social sign-in buttons"

## 从线索到查询

| 线索类型 | 怎么搜 |
|---|---|
| App 名 | 先找到这个 App，再看它的屏幕和流程（见 capabilities.md） |
| 模式 | 用下面的查询公式写成画面，全局搜 |
| 屏幕类型 | 品类 + 屏幕类型 + 可见组件，例如 "security app scan in progress screen with radar animation and percentage" |

## 查询公式

`[产品品类] + [屏幕/流程类型] + [可见组件] + [状态/动作]`

每个要素按需出现，不必全有；一次只问一件事（一个组件/一个状态），不要把多个流程塞进一条查询。

- **产品品类**（帮助匹配到对的 App 池）：fintech、crypto、banking、SaaS、AI、ecommerce、health、social……
- **屏幕/流程类型**：onboarding、dashboard、settings、confirmation、modal、empty state、error state……
- **可见组件**：input field、progress bar、tabs、card、warning banner、timeline、bottom sheet……
- **用户动作**：sign up、transfer money、connect wallet、confirm withdrawal……
- **状态**：loading、pending、failed、completed、empty、disabled……
- **信任要素**（fintech/支付类尤其有效）：security message、fee breakdown、confirmation checklist、support link……

### 平台差异（iOS vs Web）

搜索接口有 `platform` 参数（ios/web），把平台放参数里，不要写进查询词。查询词里的组件倾向按平台微调：

- **iOS 查询**：bottom sheet、action sheet、half-modal、tab bar、swipe gesture、pull-to-refresh、系统样式 alert/权限弹窗、全屏 onboarding
- **Web 查询**：sidebar、top nav、breadcrumb、modal、drawer、popover、dropdown、多栏布局、data table、toast、inline validation、sticky header

### 流程查询（search_flows）与屏幕查询（search_screens）的区别

描述整段旅程，不是单屏；比屏幕查询更宽，不堆 UI 组件：

- ✅ "user onboarding flow with account creation email verification and profile setup"
- ✅ "checkout flow from cart through payment to order confirmation"
- ✅ "crypto wallet setup flow with seed phrase backup and verification"
- ❌ "onboarding"（太笼统）
- ❌ "signup screen with email input"（这是屏幕查询不是流程查询）

## 按场景示例库

以下查询可直接取用或微调。均为英文（Mobbin 语义匹配对英文最稳）。平台按需加 `platform`。

### Onboarding / 注册

- "fintech signup screen with phone number input progress indicator security message and continue button"
- "AI app onboarding screen asking user goal with selectable cards and continue button"
- "AI chat welcome screen with suggested prompts and empty conversation state"
- "AI assistant setup screen with permissions integrations and progress steps"
- "SaaS onboarding checklist with completed and pending steps progress bar and skip option"
- 流程："user signup flow with email verification profile creation and first-use tutorial"
- 流程："AI app onboarding flow with goal selection permissions and first interaction"

### 空状态 Empty States

- "SaaS dashboard empty state with illustration explanatory text primary CTA and secondary link"
- "inbox empty state with illustration and suggested actions"
- "search results empty state with alternative suggestions and filters"

### 错误与恢复 Error / Recovery

- "payment failed screen with error message retry button support link and transaction details"
- "network error screen with retry button offline indicator and cached content"
- "form validation error state with inline error messages and highlighted fields"

### 进度与挂起 Progress / Pending

- "transfer pending screen with amount recipient estimated arrival time progress tracker and help link"
- "file upload progress screen with progress bar cancel button and file details"
- "order tracking screen with timeline status steps estimated delivery and contact support"

### 确认 Confirmation

- "crypto withdrawal confirmation screen with recipient address network fee warning text and confirm button"
- "money transfer confirmation screen with fee breakdown recipient details and confirm button"
- "subscription upgrade confirmation with plan comparison price change and billing date"

### 成功 Success

- "payment success screen with receipt transaction ID and share button"
- "account created success screen with next steps checklist and primary CTA"
- "transfer completed screen with transaction summary download receipt and done button"

### 设置 Settings

- "notification settings screen with grouped toggles channels frequency controls and save button"
- "privacy settings screen with data sharing toggles delete account option and explanation text"
- "security settings screen showing recovery phrase backup option and warning banner"
- 流程："two-factor authentication setup flow with method selection and verification"
- 流程："notification preferences flow with channel selection frequency and confirmation"

### 钱包与加密 Wallet / Crypto

- "crypto wallet seed phrase backup screen with warning text and continue button"
- "wallet recovery phrase confirmation screen with numbered words and validation error"
- "crypto portfolio dashboard with token balances price charts and send receive buttons"
- 流程："crypto wallet creation flow with seed phrase generation backup and verification"

### Fintech 转账

- "bank transfer pending screen showing amount recipient estimated arrival time and progress status"
- "international transfer screen with exchange rate fee breakdown and delivery estimate"
- "recurring payment setup screen with frequency amount date and recipient fields"
- 流程："money transfer flow from recipient selection through amount entry to confirmation"

### 结账 Checkout / 电商

- "ecommerce checkout flow from cart review through shipping payment to order confirmation"
- "subscription upgrade flow with plan comparison billing entry and confirmation"
- "in-app purchase flow with feature preview pricing and payment"

### 仪表盘 Dashboard

- "SaaS analytics dashboard with metric cards line chart data table and date range filter"
- "project management dashboard with kanban board task list and team avatars"
