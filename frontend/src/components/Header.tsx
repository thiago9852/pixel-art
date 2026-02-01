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
            className={`color-swatch ${selectedColor === c ? "selected" : ""}`}
            style={{ 
              background: c === 'ERASE' ? '#fff' : c, // Se for borracha, fundo branco
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              fontSize: '1.2rem',
              color: '#000'
            }}
            title={c === 'ERASE' ? "Borracha" : c}
          >
            {c === 'ERASE' ? (
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                viewBox="0 0 640 640"
                >
                  <path d="M210.5 480L333.5 480L398.8 414.7L225.3 
                  241.2L98.6 367.9L210.6 479.9zM256 544L210.5 544C193.5 
                  544 177.2 537.3 165.2 525.3L49 409C38.1 398.1 32 383.4 
                  32 368C32 352.6 38.1 337.9 49 327L295 81C305.9 70.1 320.6 
                  64 336 64C351.4 64 366.1 70.1 377 81L559 263C569.9 273.9 
                  576 288.6 576 304C576 319.4 569.9 334.1 559 345L424 480L544 
                  480C561.7 480 576 494.3 576 512C576 529.7 561.7 544 544 544L256 544z"
                  />
              </svg>

            ) : null } 
          </div>
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
