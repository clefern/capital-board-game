// ========================================
// LobbyUI - Interface do Lobby Multiplayer
// ========================================

import { PLAYER_COLORS, PLAYER_COLOR_ORDER } from '../config/constants.js';

export class LobbyUI {
  constructor(container, socketClient) {
    this.container = container;
    this.socket = socketClient;
    this._onGameStart = null;
    this._refreshInterval = null;
  }

  show() {
    return new Promise((resolve) => {
      this._onGameStart = resolve;
      this._renderMainMenu();
    });
  }

  _renderMainMenu() {
    this.container.innerHTML = `
      <div class="setup-screen">
        <div class="setup-logo">
          <div class="logo-icon">🏢</div>
          <h1 class="game-title">MAGNATA</h1>
          <p class="game-subtitle">Multiplayer Online</p>
        </div>
        <div class="setup-form">
          <div class="player-input" style="margin-bottom:12px">
            <input type="text" class="player-name-input" id="online-name"
                   placeholder="Seu nome" value="Jogador" maxlength="15">
          </div>
          <button class="btn btn-primary btn-large" id="create-room">
            🏠 Criar Sala
          </button>
          <button class="btn btn-secondary btn-large" id="join-room-btn" style="width:100%;margin-top:6px">
            🚪 Entrar em Sala
          </button>
          <button class="btn btn-secondary btn-large" id="browse-rooms" style="width:100%;margin-top:6px">
            🔍 Salas Abertas
          </button>
          <button class="btn btn-secondary btn-large" id="back-to-local" style="width:100%;margin-top:12px">
            ← Voltar
          </button>
        </div>
      </div>
    `;

    this.container.querySelector('#create-room').addEventListener('click', () => {
      const name = this.container.querySelector('#online-name').value.trim() || 'Jogador';
      this._createRoom(name);
    });

    this.container.querySelector('#join-room-btn').addEventListener('click', () => {
      const name = this.container.querySelector('#online-name').value.trim() || 'Jogador';
      this._showJoinDialog(name);
    });

    this.container.querySelector('#browse-rooms').addEventListener('click', () => {
      const name = this.container.querySelector('#online-name').value.trim() || 'Jogador';
      this._browseRooms(name);
    });

    this.container.querySelector('#back-to-local').addEventListener('click', () => {
      this.socket.disconnect();
      this._onGameStart(null); // Sinaliza volta ao menu local
    });
  }

  async _createRoom(playerName) {
    const result = await this.socket.createRoom(playerName);
    if (!result.success) {
      alert(`Erro: ${result.error}`);
      return;
    }
    this._renderLobby(result.roomId, playerName, true);
  }

  _showJoinDialog(playerName) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <h2>Entrar em Sala</h2>
      <div style="margin:10px 0">
        <input type="text" class="player-name-input" id="room-code"
               placeholder="Código da Sala (ex: ABC123)" maxlength="6"
               style="text-transform:uppercase;text-align:center;font-size:20px;letter-spacing:4px">
      </div>
      <div style="display:flex;gap:6px;justify-content:flex-end">
        <button class="btn btn-secondary btn-small" id="join-cancel">Cancelar</button>
        <button class="btn btn-primary btn-small" id="join-confirm">Entrar</button>
      </div>
    `;

    modal.querySelector('#join-cancel').addEventListener('click', () => overlay.remove());
    modal.querySelector('#join-confirm').addEventListener('click', async () => {
      const code = modal.querySelector('#room-code').value.trim().toUpperCase();
      if (!code) return;
      const result = await this.socket.joinRoom(code, playerName);
      overlay.remove();
      if (!result.success) {
        alert(`Erro: ${result.error}`);
        return;
      }
      this._renderLobby(code, playerName, false);
    });

    // Enter para confirmar
    modal.querySelector('#room-code').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') modal.querySelector('#join-confirm').click();
    });

    overlay.appendChild(modal);
    this.container.appendChild(overlay);
    modal.querySelector('#room-code').focus();
  }

  async _browseRooms(playerName) {
    const rooms = await this.socket.listRooms();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <h2>🔍 Salas Abertas</h2>
      ${rooms.length === 0
        ? '<p style="color:var(--text-secondary);text-align:center">Nenhuma sala aberta no momento.</p>'
        : `<div class="room-list">
            ${rooms.map(r => `
              <button class="btn target-btn room-entry" data-room="${r.roomId}">
                <span style="font-weight:700">${r.roomId}</span>
                <span>${r.hostName}</span>
                <span>${r.playerCount}/${r.maxPlayers}</span>
                <span style="font-size:11px;color:var(--text-secondary)">${r.gameMode}</span>
              </button>
            `).join('')}
          </div>`
      }
      <div style="display:flex;gap:6px;justify-content:flex-end;margin-top:10px">
        <button class="btn btn-secondary btn-small" id="rooms-close">Fechar</button>
      </div>
    `;

    modal.querySelector('#rooms-close').addEventListener('click', () => overlay.remove());

    modal.querySelectorAll('.room-entry').forEach(btn => {
      btn.addEventListener('click', async () => {
        const roomId = btn.dataset.room;
        const result = await this.socket.joinRoom(roomId, playerName);
        overlay.remove();
        if (!result.success) {
          alert(`Erro: ${result.error}`);
          return;
        }
        this._renderLobby(roomId, playerName, false);
      });
    });

    overlay.appendChild(modal);
    this.container.appendChild(overlay);
  }

  _renderLobby(roomId, myName, isHost) {
    this.container.innerHTML = `
      <div class="setup-screen">
        <div class="setup-logo">
          <div class="logo-icon">🏢</div>
          <h1 class="game-title">MAGNATA</h1>
          <p class="game-subtitle">Sala: <span class="room-code">${roomId}</span></p>
        </div>
        <div class="setup-form">
          <div class="lobby-players" id="lobby-players">
            <p style="color:var(--text-secondary)">Aguardando jogadores...</p>
          </div>
          ${isHost ? `
            <div class="player-count-selector" id="gamemode-selector-online" style="margin-top:12px">
              <label>Modo de Jogo:</label>
              <div class="count-buttons">
                <button class="count-btn diff-btn selected" data-mode="classic">Clássico</button>
                <button class="count-btn diff-btn" data-mode="rapid">Rápido</button>
                <button class="count-btn diff-btn" data-mode="marathon">Maratona</button>
              </div>
            </div>
            <button class="btn btn-primary btn-large" id="start-online" style="margin-top:12px">
              ▶ Iniciar Jogo
            </button>
          ` : `
            <p style="color:var(--text-secondary);text-align:center;margin-top:12px">
              Aguardando o host iniciar...
            </p>
          `}
          <button class="btn btn-secondary btn-large" id="leave-lobby" style="width:100%;margin-top:6px">
            ← Sair da Sala
          </button>
        </div>
      </div>
    `;

    // Listeners
    if (isHost) {
      this.container.querySelector('#start-online')?.addEventListener('click', () => {
        this.socket.startGame();
      });
    }

    this.container.querySelector('#leave-lobby').addEventListener('click', () => {
      this.socket.leaveRoom();
      this._renderMainMenu();
    });

    // Ouvir atualizações do lobby
    this.socket.on('lobby:update', (data) => {
      this._updateLobbyPlayers(data.players);
    });

    // Jogo iniciou
    this.socket.on('lobby:started', (data) => {
      clearInterval(this._refreshInterval);
      this._onGameStart(data);
    });
  }

  _updateLobbyPlayers(players) {
    const container = document.getElementById('lobby-players');
    if (!container) return;

    container.innerHTML = players.map((p, i) => {
      const color = PLAYER_COLORS[PLAYER_COLOR_ORDER[i]];
      return `
        <div class="player-input" style="border-left-color:${color.main};margin-bottom:4px">
          <span class="player-color-dot" style="background:${color.main}"></span>
          <span style="flex:1">${p.name}</span>
          ${p.isBot ? '<span style="font-size:11px;color:var(--text-secondary)">🤖 Bot</span>' : ''}
          ${i === 0 ? '<span style="font-size:11px;color:var(--accent-gold)">👑 Host</span>' : ''}
        </div>
      `;
    }).join('');

    // Mostrar slots vazios
    for (let i = players.length; i < 4; i++) {
      container.innerHTML += `
        <div class="player-input" style="opacity:0.3;margin-bottom:4px">
          <span style="flex:1;color:var(--text-secondary)">Vaga aberta...</span>
        </div>
      `;
    }
  }

  destroy() {
    clearInterval(this._refreshInterval);
  }
}
