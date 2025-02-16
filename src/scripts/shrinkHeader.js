// src/scripts/shrinkHeader.js
document.addEventListener('DOMContentLoaded', () => {
    window.addEventListener('scroll', () => {
      const header = document.querySelector('header');
      if (window.scrollY > 50) {
        header.classList.add('shrink');
      } else {
        header.classList.remove('shrink');
      }
    });
  });