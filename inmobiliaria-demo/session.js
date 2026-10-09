// Estado de la sesión del panel: quién es el usuario y con qué inmobiliaria trabaja.
export const session = {
  email: "",
  isAdmin: false, // administrador de la plataforma
  memberships: [], // [{ role, agency }]
  agency: null, // inmobiliaria activa
  role: null, // "owner" | "agent" en la inmobiliaria activa
};

export const isOwner = () => session.role === "owner";
