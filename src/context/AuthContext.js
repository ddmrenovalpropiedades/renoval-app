import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, getUserRole, getUserInitials } from '../supabaseClient';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        buildProfile(session.user);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        buildProfile(session.user);
      } else {
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const buildProfile = async (u) => {
    const email = u.email;

    // Obtener el id real de app_users (puede diferir del id de auth.users)
    const { data: appUser } = await supabase
      .from('app_users')
      .select('id')
      .eq('email', email)
      .single();

    setProfile({
      id: appUser?.id || null,
      email,
      name: u.user_metadata?.full_name || email,
      avatar: u.user_metadata?.avatar_url,
      initials: getUserInitials(email),
      iniciales: getUserInitials(email), // alias, mismas siglas DD/FD/EA/FG
      role: getUserRole(email),
      isOwner: getUserRole(email) === 'owner',
    });
    setLoading(false);
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        hd: 'renovalpropiedades.com', // restringir al dominio corporativo
      },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
