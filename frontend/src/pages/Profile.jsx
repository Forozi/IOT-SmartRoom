// src/Profile.jsx

import React from 'react';
import './Profile.css';

// Importing images from your assets folder
import avatarImg from '../assets/avatar.png';
import figmaImg from '../assets/figma.svg';
import apiImg from '../assets/apidoc.png';
import githubImg from '../assets/github.svg';
import pdfImg from '../assets/pdf.png';

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

            <div className="links-container">

                {/* Figma */}
                <div className="link-row">
                    <div className="icon-box">
                        <img src={figmaImg} alt="Figma" style={{ width: '60px' }} />
                    </div>
                    <div className="action-box">
                        <span>Figma</span>
                        <a href="https://www.figma.com/design/I9UIpnk8awD83WpsmlXQjR/Hệ-thống-giám-sát-và-kiểm-soát-trạng-thái-phòng-cá-nhân?node-id=0-1&p=f&t=arWJ1lBxSIQNRl7i-0" target="_blank" rel="noopener noreferrer" className="action-btn">My Figma</a>
                    </div>
                </div>

                {/* API Docs */}
                <div className="link-row">
                    <div className="icon-box">
                        <img src={apiImg} alt="API" style={{ width: '60px' }} />
                    </div>
                    <div className="action-box">
                        <span>API Docs</span>
                        <a href="http://localhost:5000/api-docs" target="_blank" rel="noopener noreferrer" className="action-btn">My API Docs</a>
                    </div>
                </div>

                {/* GitHub */}
                <div className="link-row">
                    <div className="icon-box">
                        <img src={githubImg} alt="GitHub" style={{ width: '60px' }} />
                    </div>
                    <div className="action-box">
                        <span>GitHub</span>
                        <a href="https://github.com/Forozi" target="_blank" rel="noopener noreferrer" className="action-btn">My GitHub</a>
                    </div>
                </div>

                {/* Report */}
                <div className="link-row">
                    <div className="icon-box">
                        <img src={pdfImg} alt="Report" style={{ width: '60px' }} />
                    </div>
                    <div className="action-box">
                        <span>Report</span>
                        <a href="https://drive.google.com/file/d/1Mk4BHOu2lRrMwktnihgsjY6tzdFMPXhV/view?usp=sharing" target="_blank" rel="noopener noreferrer" className="action-btn">My PDF</a>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default Profile;