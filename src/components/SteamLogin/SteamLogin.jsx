import "./SteamLogin.css"
import { getAuthUrl } from "../../config/urls"
import { clearAuthToken } from "../../services/auth-token"

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
          clearAuthToken()
          window.location.href = getAuthUrl("/auth/logout")
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
            window.location.href = getAuthUrl("/auth/steam")
          }}
        >
          LOGIN WITH STEAM
        </button>
      )}
    </>
  )
}
