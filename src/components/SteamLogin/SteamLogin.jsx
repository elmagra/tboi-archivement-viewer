import "./SteamLogin.css"

export function SteamProfile({ user }) {
  return (
    <div className="steam-profile">
      <div className="steam-user">
        <img
          className="steam-avatar"
          src={user.avatar}
          alt={user.name}
        />

        <p>{user.name}</p>
      </div>

      <button
        className="steam-button logout-button"
        onClick={() => {
          window.location.href =
            "http://localhost:3001/auth/logout"
        }}
      >
        LOGOUT
      </button>
    </div>
  )
}

export default function SteamLogin({ user }) {
  return (
    <>
      <h1>WHO AM I?</h1>

      {!user && (
        <button
          className="steam-button login-button"
          onClick={() => {
            window.location.href =
              "http://localhost:3001/auth/steam"
          }}
        >
          LOGIN WITH STEAM
        </button>
      )}
    </>
  )
}
