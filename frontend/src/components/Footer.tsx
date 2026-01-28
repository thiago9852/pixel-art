import React from 'react';
import './Footer.css';

// Recebe lat e lng como props
const Footer = ({ lat, lng }) => {
  return (
    <footer>
      <div style={{ display: 'flex', gap: '20px' }}>
        <div>🖱️ <b>Esq:</b> Pintar</div>
        <div>🖱️ <b>Dir:</b> Arrastar</div>
        <div>🖱️ <b>Scroll:</b> Zoom</div>
      </div>

      <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
        <a href="https://github.com/thiago9852/Art-Pixel-Doc/tree/main" target="_blank" rel="noreferrer" className='github'>GitHub</a>
        <a href="https://discord.gg/ubYVtMXK" target="_blank" rel="noreferrer" className='discord'>Discord</a>

        <div className='info-footer'>

          LAT: {lat ? lat.toFixed(5) : '0.00000'} | LNG: {lng ? lng.toFixed(5) : '0.00000'}
        </div>
      </div>
    </footer>
  );
};

export default Footer;