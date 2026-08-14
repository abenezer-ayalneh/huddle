import HuddleBrandThemeHeader from '@/components/HuddleBrandThemeHeader';

export default function LobbyHeader() {
  return (
    <header className="lobby-header">
      <div className="lobby-header-inner">
        <HuddleBrandThemeHeader homeHref="/" />
      </div>
    </header>
  );
}
