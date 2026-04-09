// src/Profile.jsx

import React from 'react';
import './Profile.css';

// Importing images from your assets folder
import avatarImg from './assets/avatar.png';
import figmaImg from './assets/figma.svg';
import apiImg from './assets/apidoc.png';
import githubImg from './assets/github.svg';
import pdfImg from './assets/pdf.png';

const Profile = () => {
    return (
        <div className="profile-page-wrapper">

            {/* LEFT: Profile Card */}
            <div className="profile-card">
                <h2>My profile</h2>
                <div className="avatar-container">
                    <img src={avatarImg} alt="Avatar" />
                </div>
                <div className="profile-info">
                    <p><strong>Họ và tên:</strong> Nguyễn Việt Anh</p>
                    <p><strong>MSV:</strong> B22DCPT014</p>
                    <p><strong>Lớp:</strong> D22PTDPT01</p>
                    <p><strong>Email:</strong> ngvietanhptit@gmail.com</p>
                    <p><strong>Address:</strong> Hanoi, VietNam</p>
                </div>
            </div>

            {/* RIGHT: Action Links (Now using local images) */}
            <div className="links-container">

                {/* Figma */}
                <div className="link-row">
                    <div className="icon-box">
                        <img src={figmaImg} alt="Figma" style={{ width: '60px' }} />
                    </div>
                    <div className="action-box">
                        <span>Figma</span>
                        <div className="action-btn">My Figma</div>
                    </div>
                </div>

                {/* API Docs */}
                <div className="link-row">
                    <div className="icon-box">
                        <img src={apiImg} alt="API" style={{ width: '60px' }} />
                    </div>
                    <div className="action-box">
                        <span>API Docs</span>
                        <div className="action-btn">My API Docs</div>
                    </div>
                </div>

                {/* GitHub */}
                <div className="link-row">
                    <div className="icon-box">
                        <img src={githubImg} alt="GitHub" style={{ width: '60px' }} />
                    </div>
                    <div className="action-box">
                        <span>GitHub</span>
                        <div className="action-btn">My GitHub</div>
                    </div>
                </div>

                {/* Report */}
                <div className="link-row">
                    <div className="icon-box">
                        <img src={pdfImg} alt="Report" style={{ width: '60px' }} />
                    </div>
                    <div className="action-box">
                        <span>Report</span>
                        <div className="action-btn">My PDF</div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default Profile;