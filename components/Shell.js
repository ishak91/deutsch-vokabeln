"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStore, totalPoints } from "./Store";
import ThemeToggle from "./ThemeToggle";
import Login from "./Login";
import Icon from "./Icon";
import { GROUPS, SETTINGS, ADMIN, TABS } from "./nav";

const Brand = () => <Link href="/" className="brand"><span className="flag" aria-hidden /><span className="brandname">Deutsch Vokabeln</span></Link>;

function NavLink({ item, path, tile }) {
  return (
    <Link href={item.href} className={(tile ? "tile" : "navlink") + (path === item.href ? " on" : "")} title={item.label} aria-current={path === item.href ? "page" : undefined}>
      <Icon name={item.icon} /><span className="lbl">{item.label}</span>
    </Link>
  );
}

// Layout: a grouped sidebar on wide screens; on phones a slim top bar, a bottom tab bar and a "Menu" sheet with everything else.
export default function Shell({ children }) {
  const path = usePathname();
  const { auth, user, logout, data, state, derived, error, saving } = useStore();
  const [menu, setMenu] = useState(false);
  const ready = data && state && derived;
  const loggedOut = auth && !auth.user;
  const pts = ready ? totalPoints(state) : 0;

  useEffect(() => setMenu(false), [path]);
  useEffect(() => {
    if (!menu) return;
    const esc = (e) => e.key === "Escape" && setMenu(false);
    document.addEventListener("keydown", esc);
    document.body.classList.add("menu-open");
    return () => { document.removeEventListener("keydown", esc); document.body.classList.remove("menu-open"); };
  }, [menu]);

  const page = loggedOut ? <Login key={auth.setup ? "setup" : "login"} /> : ready ? children : !error && <div className="loading">Loading your words…</div>;
  if (loggedOut || !user) return (
    <>
      <header className="mtop solo"><Brand /><div className="topright"><ThemeToggle compact /></div></header>
      <main className="wrap main">{error && <div className="alert">{error}</div>}{page}</main>
    </>
  );

  const me = (
    <div className="me">
      <span className="avatar" aria-hidden>{(user.name || "?").slice(0, 1).toUpperCase()}</span>
      <div className="mewho"><b>{user.name}</b><small>⭐ {pts} points · {saving ? "Saving…" : "Saved"}</small></div>
      <button className="iconbtn" onClick={logout} title="Log out" aria-label="Log out"><Icon name="logout" size={18} /></button>
    </div>
  );
  const inTabs = TABS.some(t => t.href === path);

  return (
    <>
      <aside className="side">
        <Brand />
        {ready && <Link href="/progress" className="weekcard" title="This week's theme">
          <small>Week {derived.curWeek} of {derived.maxWeek}</small><b>{data.weeks[derived.curWeek]}</b>
        </Link>}
        <nav className="sidenav" aria-label="Main">
          {GROUPS.map((g, i) => (
            <div className="navgroup" key={i}>
              {g.title && <div className="navtitle">{g.title}</div>}
              {g.items.map(it => <NavLink key={it.href} item={it} path={path} />)}
            </div>
          ))}
        </nav>
        <div className="sidefoot">
          <NavLink item={SETTINGS} path={path} />
          {user.admin && <div className="navgroup"><div className="navtitle">Admin</div>{ADMIN.map(it => <NavLink key={it.href} item={it} path={path} />)}</div>}
          {me}
          <ThemeToggle />
        </div>
      </aside>

      <header className="mtop">
        <Brand />
        {ready && <span className="weekpill">Week {derived.curWeek}</span>}
        <div className="topright">
          {!!saving && <span className="savestate">Saving…</span>}
          {ready && <span className="points" title="Points from typed answers and drills">⭐ {pts}</span>}
          <ThemeToggle compact />
        </div>
      </header>

      <div className="content">
        <main className="wrap main">{error && <div className="alert">{error}</div>}{page}</main>
      </div>

      <nav className="tabbar" aria-label="Main">
        {TABS.map(t => <NavLink key={t.href} item={t} path={path} />)}
        <button className={"navlink more" + (!inTabs || menu ? " on" : "")} onClick={() => setMenu(!menu)} aria-expanded={menu}>
          <Icon name="menu" /><span className="lbl">Menu</span>
        </button>
      </nav>

      {menu && (
        <div className="sheetback" onClick={() => setMenu(false)}>
          <div className="sheet" role="dialog" aria-label="Menu" onClick={(e) => e.stopPropagation()}>
            <div className="sheethead">
              <div>{ready && <><small className="muted">Week {derived.curWeek} of {derived.maxWeek}</small><b>{data.weeks[derived.curWeek]}</b></>}</div>
              <button className="iconbtn" onClick={() => setMenu(false)} aria-label="Close menu"><Icon name="close" size={18} /></button>
            </div>
            {GROUPS.slice(1).map(g => (
              <div key={g.title}><div className="navtitle">{g.title}</div><div className="tiles">{g.items.map(it => <NavLink key={it.href} item={it} path={path} tile />)}</div></div>
            ))}
            <div><div className="navtitle">{user.admin ? "Settings and admin" : "Settings"}</div>
              <div className="tiles">{[SETTINGS, ...(user.admin ? ADMIN : [])].map(it => <NavLink key={it.href} item={it} path={path} tile />)}</div>
            </div>
            {me}
          </div>
        </div>
      )}
    </>
  );
}
