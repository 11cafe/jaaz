from fastapi import APIRouter, Query, Request
from fastapi.responses import HTMLResponse, FileResponse
from datetime import datetime
import os
from log import get_logger
from services.db_service import db_service

logger = get_logger(__name__)
router = APIRouter()

@router.get("/privacy-html", response_class=HTMLResponse)
async def privacy_policy():
    """Privacy Policy Page - English Version with Markdown Rendering"""
    
    # Privacy Policy HTML with exact same styling as the main homepage
    privacy_html = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Privacy Policy - MagicArt AI Image Generator</title>
    <style>
        /* Reset and base styles - exact match with main app */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            background-color: #fafaf9; /* stone-50 */
            color: #0c0a09; /* stone-950 */
        }
        
        .dark {
            background-color: #0f172a; /* slate-900 */
            color: #f8fafc; /* slate-50 */
        }
        
        /* Main container with same structure as homepage */
        .page-container {
            position: relative;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        
        /* Background layers - exact match with homepage */
        .bg-gradient-main {
            position: absolute;
            inset: 0;
            background: linear-gradient(to bottom right, #fafaf9, #f5f5f4, #e2e8f0);
        }
        
        .dark .bg-gradient-main {
            background: linear-gradient(to bottom right, #0f172a, #1c1917, #374151);
        }
        
        /* Large gradient decoration - exact match */
        .bg-decoration {
            position: absolute;
            inset: 0;
            overflow: hidden;
        }
        
        .gradient-decoration {
            position: absolute;
            left: 50%;
            top: -5rem;
            transform: translateX(-50%);
            width: 400%;
            aspect-ratio: 1;
            opacity: 0.3;
            background: radial-gradient(circle at center, rgba(255, 237, 213, 0.6) 0%, rgba(254, 243, 199, 0.4) 25%, rgba(245, 245, 244, 0.3) 50%, transparent 75%);
            -webkit-mask: linear-gradient(to bottom, transparent 0%, black 25%, black 75%, transparent 100%);
            mask: linear-gradient(to bottom, transparent 0%, black 25%, black 75%, transparent 100%);
            animation: pulse-gentle 4s ease-in-out infinite;
        }
        
        @media (min-width: 640px) {
            .gradient-decoration {
                width: 200%;
            }
        }
        
        @media (min-width: 1024px) {
            .gradient-decoration {
                width: 150%;
            }
        }
        
        @keyframes pulse-gentle {
            0%, 100% { opacity: 0.3; }
            50% { opacity: 0.4; }
        }
        
        /* Texture overlay - exact match */
        .texture-overlay {
            position: absolute;
            inset: 0;
            opacity: 0.2;
            background-image: url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23374151' fill-opacity='0.015'%3E%3Cpath d='M0 0h40v40H0z'/%3E%3Cpath d='M20 20m-1 0a1 1 0 1 1 2 0a1 1 0 1 1-2 0'/%3E%3C/g%3E%3C/svg%3E");
            background-size: 40px 40px;
        }
        
        .dark .texture-overlay {
            opacity: 0.1;
        }
        
        /* Top Menu - exact match with TopMenu component */
        .top-menu {
            position: sticky;
            top: 0;
            z-index: 50;
            display: flex;
            width: 100%;
            height: 4rem; /* h-16 */
            background-color: rgba(249, 250, 251, 0.9); /* bg-gray-50/90 */
            backdrop-filter: blur(12px); /* backdrop-blur-md */
            padding-left: 0.75rem; /* px-3 */
            padding-right: 0.75rem;
            align-items: center;
            user-select: none;
            border-bottom: 1px solid rgba(229, 231, 235, 0.3); /* border-gray-200/30 */
            box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); /* shadow-sm */
        }
        
        .dark .top-menu {
            background-color: rgba(17, 24, 39, 0.9); /* dark:bg-gray-900/90 */
            border-bottom-color: rgba(55, 65, 81, 0.3); /* dark:border-gray-700/30 */
        }
        
        @media (min-width: 640px) {
            .top-menu {
                padding-left: 1.5rem; /* sm:px-6 */
                padding-right: 1.5rem;
            }
        }
        
        /* Logo section */
        .logo-section {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            min-width: 0;
            flex: 1;
        }
        
        @media (min-width: 640px) {
            .logo-section {
                gap: 2.5rem; /* sm:gap-10 */
            }
        }
        
        .logo-link {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            cursor: pointer;
            transition: all 0.2s;
            min-width: 0;
            text-decoration: none;
            color: inherit;
        }
        
        .logo-link:hover {
            transform: scale(1.05);
        }
        
        @media (min-width: 640px) {
            .logo-link {
                gap: 0.75rem; /* sm:gap-3 */
            }
        }
        
        .logo-img {
            width: 1.5rem; /* size-6 */
            height: 1.5rem;
            transition: transform 0.2s;
            flex-shrink: 0;
            background: #ef4444; /* placeholder for logo */
            border-radius: 0.25rem;
        }
        
        .logo-link:hover .logo-img {
            transform: rotate(12deg);
        }
        
        @media (min-width: 640px) {
            .logo-img {
                width: 1.75rem; /* sm:size-7 */
                height: 1.75rem;
            }
        }
        
        .logo-text {
            display: flex;
            position: relative;
            align-items: center;
            font-size: 1rem; /* text-base */
            font-weight: 700;
            color: hsl(var(--foreground, 0 0% 3.9%));
            min-width: 0;
            white-space: nowrap;
        }
        
        @media (min-width: 640px) {
            .logo-text {
                font-size: 1.125rem; /* sm:text-lg */
            }
        }
        
        @media (min-width: 768px) {
            .logo-text {
                font-size: 1.5rem; /* md:text-2xl */
            }
        }
        
        /* Navigation */
        .nav-items {
            display: flex;
            align-items: center;
            gap: 0.25rem;
        }
        
        .nav-button {
            display: flex;
            align-items: center;
            font-weight: 500;
            padding: 0.5rem 0.5rem; /* px-2 py-1.5 */
            font-size: 0.875rem; /* text-sm */
            border-radius: 0.5rem; /* rounded-lg */
            background: transparent;
            border: none;
            cursor: pointer;
            transition: all 0.2s;
            color: inherit;
            text-decoration: none;
        }
        
        .nav-button:hover {
            background-color: rgba(0, 0, 0, 0.05); /* hover:bg-muted/60 */
            transform: scale(1.05);
        }
        
        .dark .nav-button:hover {
            background-color: rgba(255, 255, 255, 0.05);
        }
        
        @media (min-width: 640px) {
            .nav-button {
                padding: 0.5rem 1rem; /* sm:px-4 sm:py-2 */
                font-size: 1rem; /* sm:text-base */
            }
        }
        
        /* Right section */
        .right-section {
            display: flex;
            align-items: center;
            gap: 0.25rem;
        }
        
        @media (min-width: 640px) {
            .right-section {
                gap: 0.5rem; /* sm:gap-2 */
            }
        }
        
        /* Main content area with ScrollArea equivalent */
        .scroll-area {
            height: 100%;
            position: relative;
            z-index: 10;
            overflow-y: auto;
        }
        
        /* Content section - exact match with homepage */
        .content-section {
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-start;
            min-height: calc(100vh - 400px);
            padding-top: 2.5rem; /* pt-[40px] */
            padding-left: 1rem; /* px-4 */
            padding-right: 1rem;
            user-select: none;
        }
        
        @media (min-width: 640px) {
            .content-section {
                min-height: calc(100vh - 460px); /* sm:min-h-[calc(100vh-460px)] */
                padding-top: 3.75rem; /* sm:pt-[60px] */
                padding-left: 1.5rem; /* sm:px-6 */
                padding-right: 1.5rem;
            }
        }
        
        /* Main content card with glassmorphism - exact match */
        .content-card {
            width: 100%;
            max-width: 56rem; /* max-w-4xl */
            margin-left: auto;
            margin-right: auto;
            backdrop-filter: blur(4px); /* backdrop-blur-sm */
            background-color: rgba(255, 255, 255, 0.6); /* bg-white/60 */
            border-radius: 1.5rem; /* rounded-3xl */
            padding: 2rem; /* p-8 */
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); /* shadow-lg */
            border: 1px solid rgba(168, 162, 158, 0.5); /* border-stone-200/50 */
            opacity: 0;
            transform: translateY(20px);
            animation: fadeInUp 0.6s ease-out 0.2s forwards;
        }
        
        .dark .content-card {
            background-color: rgba(31, 41, 55, 0.4); /* dark:bg-gray-800/40 */
            border-color: rgba(55, 65, 81, 0.5); /* dark:border-gray-700/50 */
        }
        
        @media (min-width: 640px) {
            .content-card {
                padding: 3rem; /* sm:p-12 */
            }
        }
        
        @keyframes fadeInUp {
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        /* Typography - exact match with homepage */
        .main-title {
            font-size: 1.5rem; /* text-2xl */
            font-weight: 700;
            margin-bottom: 1rem; /* mb-4 */
            text-align: center;
            background: linear-gradient(to bottom right, #111827, #374151, #57534e); /* from-gray-900 via-gray-700 to-stone-600 */
            background-clip: text;
            -webkit-background-clip: text;
            color: transparent;
            line-height: 1.25; /* leading-tight */
        }
        
        .dark .main-title {
            background: linear-gradient(to bottom right, #ffffff, #e5e7eb, #d6d3d1); /* dark:from-white dark:via-gray-200 dark:to-stone-300 */
            background-clip: text;
            -webkit-background-clip: text;
        }
        
        @media (min-width: 640px) {
            .main-title {
                font-size: 1.875rem; /* sm:text-3xl */
                margin-bottom: 1.5rem; /* sm:mb-6 */
            }
        }
        
        @media (min-width: 768px) {
            .main-title {
                font-size: 2.25rem; /* md:text-4xl */
            }
        }
        
        @media (min-width: 1024px) {
            .main-title {
                font-size: 3rem; /* lg:text-5xl */
            }
        }
        
        .subtitle {
            font-size: 0.875rem; /* text-sm */
            color: #57534e; /* text-stone-600 */
            margin-bottom: 2rem; /* mb-8 */
            text-align: center;
            padding-left: 0.5rem; /* px-2 */
            padding-right: 0.5rem;
            line-height: 1.625; /* leading-relaxed */
            font-weight: 500;
        }
        
        .dark .subtitle {
            color: #d6d3d1; /* dark:text-stone-300 */
        }
        
        @media (min-width: 640px) {
            .subtitle {
                font-size: 1rem; /* sm:text-base */
                margin-bottom: 2.5rem; /* sm:mb-10 */
                padding-left: 1rem; /* sm:px-4 */
                padding-right: 1rem;
            }
        }
        
        @media (min-width: 768px) {
            .subtitle {
                font-size: 1.125rem; /* md:text-lg */
            }
        }
        
        @media (min-width: 1024px) {
            .subtitle {
                font-size: 1.25rem; /* lg:text-xl */
            }
        }
        
        /* Content styling */
        .last-updated {
            background: rgba(59, 130, 246, 0.1); /* blue tint */
            border: 1px solid rgba(59, 130, 246, 0.3);
            padding: 1rem;
            border-radius: 0.5rem;
            margin-bottom: 2rem;
            text-align: center;
            font-weight: 500;
            color: #1d4ed8; /* blue-700 */
        }
        
        .dark .last-updated {
            color: #60a5fa; /* blue-400 */
        }
        
        h2 {
            color: #1f2937; /* gray-800 */
            margin-top: 2rem;
            margin-bottom: 1rem;
            font-size: 1.25rem;
            font-weight: 600;
            border-left: 4px solid #3b82f6; /* blue-500 */
            padding-left: 1rem;
        }
        
        .dark h2 {
            color: #e5e7eb; /* gray-200 */
        }
        
        h3 {
            color: #374151; /* gray-700 */
            margin-top: 1.5rem;
            margin-bottom: 0.75rem;
            font-size: 1.125rem;
            font-weight: 600;
        }
        
        .dark h3 {
            color: #d1d5db; /* gray-300 */
        }
        
        h4 {
            color: #4b5563; /* gray-600 */
            margin-top: 1.25rem;
            margin-bottom: 0.5rem;
            font-size: 1rem;
            font-weight: 600;
        }
        
        .dark h4 {
            color: #9ca3af; /* gray-400 */
        }
        
        p {
            margin: 0.75rem 0;
            color: #57534e; /* stone-600 */
            text-align: justify;
        }
        
        .dark p {
            color: #d6d3d1; /* stone-300 */
        }
        
        ul, ol {
            margin: 0.75rem 0;
            padding-left: 1.5rem;
            color: #57534e; /* stone-600 */
        }
        
        .dark ul,
        .dark ol {
            color: #d6d3d1; /* stone-300 */
        }
        
        li {
            margin: 0.5rem 0;
        }
        
        .definition-section {
            background: rgba(59, 130, 246, 0.05);
            border: 1px solid rgba(59, 130, 246, 0.2);
            padding: 1.5rem;
            border-radius: 0.5rem;
            margin: 1.5rem 0;
        }
        
        .dark .definition-section {
            background: rgba(59, 130, 246, 0.1);
        }
        
        .important-note {
            background: rgba(245, 158, 11, 0.1);
            border: 1px solid rgba(245, 158, 11, 0.3);
            padding: 1rem;
            border-radius: 0.5rem;
            margin: 1.5rem 0;
        }
        
        .cookie-types {
            background: rgba(59, 130, 246, 0.03);
            padding: 1rem;
            border-radius: 0.5rem;
            margin: 1rem 0;
            border: 1px solid rgba(59, 130, 246, 0.1);
        }
        
        .cookie-type {
            margin: 1rem 0;
            padding: 1rem;
            background: rgba(255, 255, 255, 0.8);
            border-radius: 0.375rem;
            border-left: 4px solid #3b82f6;
        }
        
        .dark .cookie-type {
            background: rgba(31, 41, 55, 0.8);
        }
        
        .cookie-type strong {
            color: #1d4ed8;
        }
        
        .dark .cookie-type strong {
            color: #60a5fa;
        }
        
        code {
            background: rgba(59, 130, 246, 0.1);
            color: #1d4ed8;
            padding: 0.125rem 0.5rem;
            border-radius: 0.25rem;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 0.875rem;
        }
        
        .dark code {
            color: #60a5fa;
        }
        
        .footer {
            margin-top: 3rem;
            padding-top: 1.5rem;
            border-top: 2px solid rgba(59, 130, 246, 0.2);
            text-align: center;
            color: #6b7280;
            font-size: 0.875rem;
        }
        
        .dark .footer {
            color: #9ca3af;
        }
    </style>
</head>
<body>
    <div class="page-container">
        <!-- Background layers - exact match with homepage -->
        <div class="bg-gradient-main"></div>
        <div class="bg-decoration">
            <div class="gradient-decoration"></div>
        </div>
        <div class="texture-overlay"></div>

        <div class="scroll-area">
            <!-- Top Menu - exact match with TopMenu component -->
            <div class="top-menu">
                <div class="logo-section">
                    <a href="/" class="logo-link">
                        <div class="logo-img"></div>
                        <div class="logo-text">
                            <span>MagicArt</span>
                        </div>
                    </a>
                    <nav class="nav-items">
                        <a href="/templates" class="nav-button">模版</a>
                        <a href="/pricing" class="nav-button">定价</a>
                    </nav>
                </div>
                <div class="right-section">
                    <!-- Theme and user controls would go here -->
                </div>
            </div>

            <!-- Main content section -->
            <div class="content-section">
                <div class="content-card">
        
        <h1>Privacy Policy</h1>
        
        <div class="last-updated">
            <strong>Last updated:</strong> August 26, 2025
        </div>
        
        <p>This Privacy Policy describes Our policies and procedures on the collection, use and disclosure of Your information when You use the Service and tells You about Your privacy rights and how the law protects You.</p>
        
        <p>We use Your Personal data to provide and improve the Service. By using the Service, You agree to the collection and use of information in accordance with this Privacy Policy.</p>
        
        <h2>Interpretation and Definitions</h2>
        
        <h3>Interpretation</h3>
        <p>The words of which the initial letter is capitalized have meanings defined under the following conditions. The following definitions shall have the same meaning regardless of whether they appear in singular or in plural.</p>
        
        <h3>Definitions</h3>
        <p>For the purposes of this Privacy Policy:</p>
        
        <div class="definition-section">
            <ul>
                <li><strong>Account</strong> means a unique account created for You to access our Service or parts of our Service.</li>
                <li><strong>Affiliate</strong> means an entity that controls, is controlled by or is under common control with a party, where "control" means ownership of 50% or more of the shares, equity interest or other securities entitled to vote for election of directors or other managing authority.</li>
                <li><strong>Company</strong> (referred to as either "the Company", "We", "Us" or "Our" in this Agreement) refers to MagicArt AI Image Generator.</li>
                <li><strong>Cookies</strong> are small files that are placed on Your computer, mobile device or any other device by a website, containing the details of Your browsing history on that website among its many uses.</li>
                <li><strong>Country</strong> refers to: California, United States</li>
                <li><strong>Device</strong> means any device that can access the Service such as a computer, a cellphone or a digital tablet.</li>
                <li><strong>Personal Data</strong> is any information that relates to an identified or identifiable individual.</li>
                <li><strong>Service</strong> refers to the Website.</li>
                <li><strong>Service Provider</strong> means any natural or legal person who processes the data on behalf of the Company. It refers to third-party companies or individuals employed by the Company to facilitate the Service, to provide the Service on behalf of the Company, to perform services related to the Service or to assist the Company in analyzing how the Service is used.</li>
                <li><strong>Third-party Social Media Service</strong> refers to any website or any social network website through which a User can log in or create an account to use the Service.</li>
                <li><strong>Usage Data</strong> refers to data collected automatically, either generated by the use of the Service or from the Service infrastructure itself (for example, the duration of a page visit).</li>
                <li><strong>Website</strong> refers to MagicArt AI Image Generator, accessible from <code>https://www.magicart.cc</code></li>
                <li><strong>You</strong> means the individual accessing or using the Service, or the company, or other legal entity on behalf of which such individual is accessing or using the Service, as applicable.</li>
            </ul>
        </div>
        
        <h2>Collecting and Using Your Personal Data</h2>
        
        <h3>Types of Data Collected</h3>
        
        <h4>Personal Data</h4>
        <p>While using Our Service, We may ask You to provide Us with certain personally identifiable information that can be used to contact or identify You. Personally identifiable information may include, but is not limited to:</p>
        <ul>
            <li>Email address</li>
            <li>First name and last name</li>
            <li>Usage Data</li>
        </ul>
        
        <h4>Usage Data</h4>
        <p>Usage Data is collected automatically when using the Service.</p>
        
        <p>Usage Data may include information such as Your Device's Internet Protocol address (e.g. IP address), browser type, browser version, the pages of our Service that You visit, the time and date of Your visit, the time spent on those pages, unique device identifiers and other diagnostic data.</p>
        
        <p>When You access the Service by or through a mobile device, We may collect certain information automatically, including, but not limited to, the type of mobile device You use, Your mobile device unique ID, the IP address of Your mobile device, Your mobile operating system, the type of mobile Internet browser You use, unique device identifiers and other diagnostic data.</p>
        
        <p>We may also collect information that Your browser sends whenever You visit our Service or when You access the Service by or through a mobile device.</p>
        
        <h4>Information from Third-Party Social Media Services</h4>
        <p>The Company allows You to create an account and log in to use the Service through the following Third-party Social Media Services:</p>
        <ul>
            <li>Google</li>
            <li>Facebook</li>
            <li>Instagram</li>
            <li>Twitter</li>
            <li>LinkedIn</li>
        </ul>
        
        <p>If You decide to register through or otherwise grant us access to a Third-Party Social Media Service, We may collect Personal data that is already associated with Your Third-Party Social Media Service's account, such as Your name, Your email address, Your activities or Your contact list associated with that account.</p>
        
        <p>You may also have the option of sharing additional information with the Company through Your Third-Party Social Media Service's account. If You choose to provide such information and Personal Data, during registration or otherwise, You are giving the Company permission to use, share, and store it in a manner consistent with this Privacy Policy.</p>
        
        <h3>Tracking Technologies and Cookies</h3>
        <p>We use Cookies and similar tracking technologies to track the activity on Our Service and store certain information. Tracking technologies used are beacons, tags, and scripts to collect and track information and to improve and analyze Our Service. The technologies We use may include:</p>
        
        <ul>
            <li><strong>Cookies or Browser Cookies.</strong> A cookie is a small file placed on Your Device. You can instruct Your browser to refuse all Cookies or to indicate when a Cookie is being sent. However, if You do not accept Cookies, You may not be able to use some parts of our Service. Unless you have adjusted Your browser setting so that it will refuse Cookies, our Service may use Cookies.</li>
            <li><strong>Web Beacons.</strong> Certain sections of our Service and our emails may contain small electronic files known as web beacons (also referred to as clear gifs, pixel tags, and single-pixel gifs) that permit the Company, for example, to count users who have visited those pages or opened an email and for other related website statistics (for example, recording the popularity of a certain section and verifying system and server integrity).</li>
        </ul>
        
        <p>Cookies can be "Persistent" or "Session" Cookies. Persistent Cookies remain on Your personal computer or mobile device when You go offline, while Session Cookies are deleted as soon as You close Your web browser.</p>
        
        <p>We use both Session and Persistent Cookies for the purposes set out below:</p>
        
        <div class="cookie-types">
            <div class="cookie-type">
                <strong>Necessary / Essential Cookies</strong><br>
                <strong>Type:</strong> Session Cookies<br>
                <strong>Administered by:</strong> Us<br>
                <strong>Purpose:</strong> These Cookies are essential to provide You with services available through the Website and to enable You to use some of its features. They help to authenticate users and prevent fraudulent use of user accounts. Without these Cookies, the services that You have asked for cannot be provided, and We only use these Cookies to provide You with those services.
            </div>
            
            <div class="cookie-type">
                <strong>Cookies Policy / Notice Acceptance Cookies</strong><br>
                <strong>Type:</strong> Persistent Cookies<br>
                <strong>Administered by:</strong> Us<br>
                <strong>Purpose:</strong> These Cookies identify if users have accepted the use of cookies on the Website.
            </div>
            
            <div class="cookie-type">
                <strong>Functionality Cookies</strong><br>
                <strong>Type:</strong> Persistent Cookies<br>
                <strong>Administered by:</strong> Us<br>
                <strong>Purpose:</strong> These Cookies allow us to remember choices You make when You use the Website, such as remembering your login details or language preference. The purpose of these Cookies is to provide You with a more personal experience and to avoid You having to re-enter your preferences every time You use the Website.
            </div>
        </div>
        
        <p>For more information about the cookies we use and your choices regarding cookies, please visit our Cookies Policy or the Cookies section of our Privacy Policy.</p>
        
        <h2>Use of Your Personal Data</h2>
        <p>The Company may use Personal Data for the following purposes:</p>
        <ul>
            <li><strong>To provide and maintain our Service</strong>, including to monitor the usage of our Service.</li>
            <li><strong>To manage Your Account:</strong> to manage Your registration as a user of the Service. The Personal Data You provide can give You access to different functionalities of the Service that are available to You as a registered user.</li>
            <li><strong>For the performance of a contract:</strong> the development, compliance and undertaking of the purchase contract for the products, items or services You have purchased or of any other contract with Us through the Service.</li>
            <li><strong>To contact You:</strong> To contact You by email, telephone calls, SMS, or other equivalent forms of electronic communication, such as a mobile application's push notifications regarding updates or informative communications related to the functionalities, products or contracted services, including the security updates, when necessary or reasonable for their implementation.</li>
            <li><strong>To provide You</strong> with news, special offers and general information about other goods, services and events which we offer that are similar to those that you have already purchased or enquired about unless You have opted not to receive such information.</li>
            <li><strong>To manage Your requests:</strong> To attend and manage Your requests to Us.</li>
            <li><strong>For business transfers:</strong> We may use Your information to evaluate or conduct a merger, divestiture, restructuring, reorganization, dissolution, or other sale or transfer of some or all of Our assets, whether as a going concern or as part of bankruptcy, liquidation, or similar proceeding, in which Personal Data held by Us about our Service users is among the assets transferred.</li>
            <li><strong>For other purposes:</strong> We may use Your information for other purposes, such as data analysis, identifying usage trends, determining the effectiveness of our promotional campaigns and to evaluate and improve our Service, products, services, marketing and your experience.</li>
        </ul>
        
        <p>We may share Your personal information in the following situations:</p>
        <ul>
            <li><strong>With Service Providers:</strong> We may share Your personal information with Service Providers to monitor and analyze the use of our Service, to contact You.</li>
            <li><strong>For business transfers:</strong> We may share or transfer Your personal information in connection with, or during negotiations of, any merger, sale of Company assets, financing, or acquisition of all or a portion of Our business to another company.</li>
            <li><strong>With Affiliates:</strong> We may share Your information with Our affiliates, in which case we will require those affiliates to honor this Privacy Policy. Affiliates include Our parent company and any other subsidiaries, joint venture partners or other companies that We control or that are under common control with Us.</li>
            <li><strong>With business partners:</strong> We may share Your information with Our business partners to offer You certain products, services or promotions.</li>
            <li><strong>With other users:</strong> when You share personal information or otherwise interact in the public areas with other users, such information may be viewed by all users and may be publicly distributed outside. If You interact with other users or register through a Third-Party Social Media Service, Your contacts on the Third-Party Social Media Service may see Your name, profile, pictures and description of Your activity. Similarly, other users will be able to view descriptions of Your activity, communicate with You and view Your profile.</li>
            <li><strong>With Your consent:</strong> We may disclose Your personal information for any other purpose with Your consent.</li>
        </ul>
        
        <h2>Retention of Your Personal Data</h2>
        <p>The Company will retain Your Personal Data only for as long as is necessary for the purposes set out in this Privacy Policy. We will retain and use Your Personal Data to the extent necessary to comply with our legal obligations (for example, if we are required to retain your data to comply with applicable laws), resolve disputes, and enforce our legal agreements and policies.</p>
        
        <p>The Company will also retain Usage Data for internal analysis purposes. Usage Data is generally retained for a shorter period of time, except when this data is used to strengthen the security or to improve the functionality of Our Service, or We are legally obligated to retain this data for longer time periods.</p>
        
        <h2>Transfer of Your Personal Data</h2>
        <p>Your information, including Personal Data, is processed at the Company's operating offices and in any other places where the parties involved in the processing are located. It means that this information may be transferred to — and maintained on — computers located outside of Your state, province, country or other governmental jurisdiction where the data protection laws may differ than those from Your jurisdiction.</p>
        
        <p>Your consent to this Privacy Policy followed by Your submission of such information represents Your agreement to that transfer.</p>
        
        <p>The Company will take all steps reasonably necessary to ensure that Your data is treated securely and in accordance with this Privacy Policy and no transfer of Your Personal Data will take place to an organization or a country unless there are adequate controls in place including the security of Your data and other personal information.</p>
        
        <h2>Delete Your Personal Data</h2>
        <p>You have the right to delete or request that We assist in deleting the Personal Data that We have collected about You.</p>
        
        <p>Our Service may give You the ability to delete certain information about You from within the Service.</p>
        
        <p>You may update, amend, or delete Your information at any time by signing in to Your Account, if you have one, and visiting the account settings section that allows you to manage Your personal information. You may also contact Us to request access to, correct, or delete any personal information that You have provided to Us.</p>
        
        <div class="important-note">
            <strong>Please note, however, that We may need to retain certain information when we have a legal obligation or lawful basis to do so.</strong>
        </div>
        
        <h2>Disclosure of Your Personal Data</h2>
        
        <h3>Business Transactions</h3>
        <p>If the Company is involved in a merger, acquisition or asset sale, Your Personal Data may be transferred. We will provide notice before Your Personal Data is transferred and becomes subject to a different Privacy Policy.</p>
        
        <h3>Law enforcement</h3>
        <p>Under certain circumstances, the Company may be required to disclose Your Personal Data if required to do so by law or in response to valid requests by public authorities (e.g. a court or a government agency).</p>
        
        <h3>Other legal requirements</h3>
        <p>The Company may disclose Your Personal Data in the good faith belief that such action is necessary to:</p>
        <ul>
            <li>Comply with a legal obligation</li>
            <li>Protect and defend the rights or property of the Company</li>
            <li>Prevent or investigate possible wrongdoing in connection with the Service</li>
            <li>Protect the personal safety of Users of the Service or the public</li>
            <li>Protect against legal liability</li>
        </ul>
        
        <h2>Security of Your Personal Data</h2>
        <p>The security of Your Personal Data is important to Us, but remember that no method of transmission over the Internet, or method of electronic storage is 100% secure. While We strive to use commercially acceptable means to protect Your Personal Data, We cannot guarantee its absolute security.</p>
        
        <h2>Children's Privacy</h2>
        <p>Our Service does not address anyone under the age of 13. We do not knowingly collect personally identifiable information from anyone under the age of 13. If You are a parent or guardian and You are aware that Your child has provided Us with Personal Data, please contact Us. If We become aware that We have collected Personal Data from anyone under the age of 13 without verification of parental consent, We take steps to remove that information from Our servers.</p>
        
        <p>If We need to rely on consent as a legal basis for processing Your information and Your country requires consent from a parent, We may require Your parent's consent before We collect and use that information.</p>
        
        <h2>Links to Other Websites</h2>
        <p>Our Service may contain links to other websites that are not operated by Us. If You click on a third party link, You will be directed to that third party's site. We strongly advise You to review the Privacy Policy of every site You visit.</p>
        
        <p>We have no control over and assume no responsibility for the content, privacy policies or practices of any third party sites or services.</p>
        
        <h2>Changes to this Privacy Policy</h2>
        <p>We may update Our Privacy Policy from time to time. We will notify You of any changes by posting the new Privacy Policy on this page.</p>
        
        <p>We will let You know via email and/or a prominent notice on Our Service, prior to the change becoming effective and update the "Last updated" date at the top of this Privacy Policy.</p>
        
        <p>You are advised to review this Privacy Policy periodically for any changes. Changes to this Privacy Policy are effective when they are posted on this page.</p>
        
        <div class="footer">
            <p>© 2025 MagicArt AI Image Generator. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
    """
    
    return privacy_html

@router.get("/privacy-simple", response_class=HTMLResponse)
async def privacy_policy_simple():
    """隐私政策页面 - 简化版"""
    
    # 获取模板文件路径
    template_path = os.path.join(os.path.dirname(__file__), "..", "templates", "privacy_simple.html")
    
    # 检查文件是否存在
    if os.path.exists(template_path):
        return FileResponse(template_path, media_type="text/html")
    else:
        # 如果模板文件不存在，返回简化的HTML
        simple_html = """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>隐私政策 - MagicArt AI</title>
    <style>
        body { font-family: system-ui, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1 { color: #2c3e50; }
        .back-link { display: inline-block; background: #3498db; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px; margin-bottom: 20px; }
    </style>
</head>
<body>
    <a href="/" class="back-link">← 返回首页</a>
    <h1>隐私政策</h1>
    <p><strong>最后更新：</strong> August 26, 2025</p>
    <p>我们重视您的隐私并致力于保护您的个人信息。本政策说明我们如何收集、使用和保护您的数据。</p>
    <h2>信息收集</h2>
    <p>我们收集您提供的信息（如邮箱、姓名）和自动收集的信息（如使用数据）。</p>
    <h2>信息使用</h2>
    <p>我们使用您的信息来提供服务、改进用户体验和与您联系。</p>
    <h2>联系我们</h2>
    <p>如有疑问，请联系：privacy@magicart.cc</p>
</body>
</html>
        """
        return simple_html