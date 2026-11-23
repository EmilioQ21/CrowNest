const ENV = {
  // Datos de la API externa
  TMDB_API_KEY: '3d00f706e023b8eedd3b29eb9d6e193c',
  TMDB_BASE_URL: 'https://api.themoviedb.org/3',
  TMDB_IMG_URL: 'https://image.tmdb.org/t/p/w500',

  BACKEND_URL: 'http://localhost:3000/',
};

function validateLogin() {
  if (!sessionStorage.user && window.location.href != ENV.BACKEND_URL) {
    alert('Favor de iniciar sesión');
    window.location.href = ENV.BACKEND_URL;
  }
  if (sessionStorage.user && window.location.href == ENV.BACKEND_URL) {
    window.location.href = ENV.BACKEND_URL + 'home.html';
  }
}
validateLogin();
