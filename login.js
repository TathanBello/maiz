document.getElementById("loginForm").addEventListener("submit", (e) => {
  e.preventDefault();

  const user = document.getElementById("username").value.trim();
  const pass = document.getElementById("password").value.trim();

  // Usuarios válidos
  const users = {
    "tathan": "142005",
    "gacha": "123450"
  };

  // Verificar credenciales
  if (users[user] && users[user] === pass) {
    localStorage.setItem("loggedUser", user);
    window.location.href = "index.html";
  } else {
    document.getElementById("loginError").textContent = "Usuario o contraseña incorrectos.";
  }
});
