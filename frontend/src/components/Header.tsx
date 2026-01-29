import React from "react";
import "./Header.css";

const Header = ({ palette, selectedColor, setSelectedColor, onlineCount }) => {
  return (
    <header>
      {/* Logo */}
      <div>
        <h2 className="logo-title">
          <img className="img-logo" src="./pixel-logo-design.png" alt="Logo pixel art" />
           <span className="highlight">Art</span> Pixel
        </h2>
      </div>

      {/* Paleta de cores */}
      <div className="palette">
        {palette.map((c) => (
          <div
            key={c}
            onClick={() => setSelectedColor(c)}
            style={{ background: c }}
            className={selectedColor === c ? "selected" : ""}
          />
        ))}
      </div>

      {/* Status */}
      <div className="status">
        <span style={{ color: "#00d1b2" }}>●</span> Online: {onlineCount || 0}
      </div>
    </header>
  );
};

export default Header;
