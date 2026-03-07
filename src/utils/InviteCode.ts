export function generateInviteCode() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
  const numbers = "0123456789"
  const allChars = letters + numbers

  let code = "CHUG"

  for (let i = 0; i < 3; i++) {
    code += allChars[Math.floor(Math.random() * allChars.length)]
  }

  return code
}