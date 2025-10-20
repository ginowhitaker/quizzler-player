import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

export default function QuizzlerPlayerApp() {
  const [socket, setSocket] = useState(null);
  const [screen, setScreen] = useState('welcome');
  const [gameCode, setGameCode] = useState('');
  const [teamName, setTeamName] = useState('');
  const [game, setGame] = useState(null);
  const [team, setTeam] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [answer, setAnswer] = useState('');
  const [selectedConfidence, setSelectedConfidence] = useState(null);
  const [wager, setWager] = useState('');

  useEffect(() => {
    const newSocket = io(API_URL, {
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => console.log('Connected'));
    newSocket.on('error', (error) => alert(error.message));

    setSocket(newSocket);
    return () => newSocket.close();
  }, []);

  useEffect(() => {
    if (!socket) return;

    socket.on('player:joined', ({ game: g, team: t }) => {
      setGame(g);
      setTeam(t);
      setScreen('waiting');
    });

    socket.on('question:pushed', ({ questionNumber, questionText }) => {
      setCurrentQuestion({ number: questionNumber, text: questionText });
      setGame(prev => ({ ...prev, status: 'active', questionNumber }));
      setAnswer('');
      setSelectedConfidence(null);
      setScreen('question');
    });

    socket.on('question:final', ({ questionText }) => {
      setCurrentQuestion({ text: questionText, isFinal: true });
      setGame(prev => ({ ...prev, status: 'final' }));
      setAnswer('');
      setWager('');
      setScreen('finalQuestion');
    });

    socket.on('game:waiting', () => {
      setScreen('waiting');
      setCurrentQuestion(null);
    });

    socket.on('answer:submitted', ({ questionKey }) => {
      setScreen('answerSubmitted');
    });

    socket.on('answer:marked', ({ correct, newScore }) => {
      setTeam(prev => ({ ...prev, score: newScore }));
      setScreen(correct ? 'correct' : 'incorrect');
      setTimeout(() => setScreen('waiting'), 3000);
    });

    socket.on('game:completed', ({ winner, winnerScore, leaderboard }) => {
      setGame(prev => ({ ...prev, status: 'completed', winner, winnerScore, leaderboard }));
      setScreen('gameComplete');
    });

    return () => {
      socket.off('player:joined');
      socket.off('question:pushed');
      socket.off('question:final');
      socket.off('game:waiting');
      socket.off('answer:submitted');
      socket.off('answer:marked');
      socket.off('game:completed');
    };
  }, [socket]);

  const handleJoinGame = () => {
    if (!gameCode || !teamName) {
      alert('Please enter both game code and team name');
      return;
    }
    socket.emit('player:join', { gameCode: gameCode.toUpperCase(), teamName });
  };

  const handleSubmitAnswer = () => {
    if (!answer) {
      alert('Please enter an answer');
      return;
    }

    if (game.status === 'final') {
      const wagerNum = parseInt(wager);
      if (isNaN(wagerNum) || wagerNum < 0 || wagerNum > 20) {
        alert('Wager must be between 0 and 20');
        return;
      }
      socket.emit('player:submitAnswer', {
        gameCode,
        teamName,
        answer,
        confidence: wagerNum
      });
    } else {
      if (!selectedConfidence) {
        alert('Please select a confidence score');
        return;
      }
      if (team.usedConfidences.includes(selectedConfidence)) {
        alert('You have already used this confidence score!');
        return;
      }
      socket.emit('player:submitAnswer', {
        gameCode,
        teamName,
        answer,
        confidence: selectedConfidence
      });
      setTeam(prev => ({
        ...prev,
        usedConfidences: [...prev.usedConfidences, selectedConfidence]
      }));
    }
  };

  return (
    <div className="quizzler-player">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Paytone+One&family=Gabarito:wght@400;500;600;700&display=swap');
        
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: 'Gabarito', sans-serif;
          -webkit-font-smoothing: antialiased;
        }

        .quizzler-player {
          min-height: 100vh;
          background: radial-gradient(ellipse at center, #FFFFCC 0%, #FFFF99 25%, #FFFF66 50%, #FFFF33 75%, #FFFF00 100%);
          background-image: 
            repeating-conic-gradient(
              from 0deg at 50% 50%,
              #FFFFEE 0deg 15deg,
              #FFFF99 15deg 30deg
            );
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 20px;
        }

        .screen {
          width: 100%;
          max-width: 450px;
          background: rgba(255, 255, 255, 0.95);
          border-radius: 30px;
          padding: 40px 30px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.2);
          text-align: center;
        }

        .logo {
          font-family: 'Paytone One', sans-serif;
          font-size: 48px;
          color: #FF6600;
          margin-bottom: 20px;
          letter-spacing: 2px;
        }

        .icon {
          width: 120px;
          height: 120px;
          margin: 0 auto 30px;
        }

        .icon-svg {
          width: 100%;
          height: 100%;
        }

        h2 {
          color: #286586;
          font-size: 28px;
          font-weight: 600;
          margin-bottom: 15px;
        }

        .event-info {
          color: #286586;
          font-size: 16px;
          margin-bottom: 20px;
          line-height: 1.5;
        }

        .team-name {
          color: #286586;
          font-size: 24px;
          font-weight: 700;
          margin-bottom: 15px;
        }

        .score-display {
          color: #286586;
          font-size: 18px;
          font-weight: 600;
          margin-bottom: 20px;
        }

        .score-value {
          font-size: 32px;
          color: #FF6600;
        }

        .input-field {
          width: 100%;
          padding: 15px;
          font-size: 16px;
          font-family: 'Gabarito', sans-serif;
          border: 2px solid #286586;
          border-radius: 10px;
          margin-bottom: 15px;
          text-align: center;
        }

        .input-field:focus {
          outline: none;
          border-color: #32ADE6;
        }

        .submit-button {
          width: 100%;
          max-width: 200px;
          padding: 15px 30px;
          background: #32ADE6;
          color: #FFFFFF;
          font-size: 18px;
          font-weight: 600;
          font-family: 'Gabarito', sans-serif;
          border: none;
          border-radius: 25px;
          cursor: pointer;
          transition: all 0.3s;
          margin: 20px auto 0;
          display: block;
        }

        .submit-button:hover {
          background: #2894C7;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(50, 173, 230, 0.4);
        }

        .submit-button:active {
          transform: translateY(0);
        }

        .question-header {
          color: #286586;
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 10px;
        }

        .question-text {
          color: #286586;
          font-size: 20px;
          font-weight: 500;
          margin-bottom: 20px;
          line-height: 1.4;
        }

        .confidence-label {
          color: #286586;
          font-size: 18px;
          font-weight: 600;
          margin: 25px 0 15px;
        }

        .confidence-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 10px;
          margin-bottom: 20px;
        }

        .confidence-box {
          aspect-ratio: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          font-weight: 600;
          border: 1px solid #286586;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
          background: white;
          color: #286586;
        }

        .confidence-box:hover:not(.used):not(.selected) {
          background: #E8F4F8;
          border-width: 2px;
        }

        .confidence-box.selected {
          background: #32ADE6;
          color: white;
          border: 3px solid #286586;
          transform: scale(1.05);
        }

        .confidence-box.used {
          background: #D3D3D3;
          color: #888;
          cursor: not-allowed;
          border-color: #AAA;
        }

        .divider {
          width: 100%;
          height: 2px;
          background: #286586;
          margin: 30px 0;
        }

        .promo-space {
          color: #286586;
          font-size: 14px;
          font-style: italic;
          margin-top: 20px;
        }

        .feedback-icon {
          font-size: 80px;
          margin: 20px 0;
        }

        .correct-text {
          color: #00AA00;
          font-size: 36px;
          font-weight: 700;
          margin: 20px 0;
        }

        .incorrect-text {
          color: #C60404;
          font-size: 36px;
          font-weight: 700;
          margin: 20px 0;
        }

        .leaderboard {
          text-align: left;
          margin: 20px 0;
          max-height: 400px;
          overflow-y: auto;
        }

        .leaderboard-item {
          color: #286586;
          font-size: 16px;
          padding: 8px 0;
          border-bottom: 1px solid #E0E0E0;
        }

        .placement-text {
          color: #286586;
          font-size: 20px;
          font-weight: 600;
          margin-bottom: 20px;
        }

        .thank-you {
          font-size: 24px;
          color: #286586;
          font-weight: 600;
          margin: 30px 0;
        }

        .see-you {
          font-size: 28px;
          color: #286586;
          font-weight: 700;
          margin-top: 30px;
        }

        @media (max-width: 480px) {
          .screen {
            padding: 30px 20px;
          }
          
          .logo {
            font-size: 36px;
          }
          
          .confidence-grid {
            gap: 8px;
          }
          
          .confidence-box {
            font-size: 18px;
          }
        }
      `}</style>

      {screen === 'welcome' && (
        <div className="screen">
          <div className="logo">QUIZZLER</div>
          <div className="icon">
            <svg className="icon-svg" viewBox="0 0 200 200">
              <circle cx="100" cy="40" r="20" fill="#FF6600"/>
              <text x="100" y="50" textAnchor="middle" fill="white" fontSize="28" fontWeight="bold">?</text>
              <rect x="95" y="60" width="10" height="40" fill="#FF6600"/>
              <ellipse cx="100" cy="120" rx="60" ry="10" fill="#FF6600" opacity="0.3"/>
              <ellipse cx="100" cy="125" rx="50" ry="8" fill="#FF6600" opacity="0.4"/>
              <ellipse cx="100" cy="130" rx="40" ry="6" fill="#FF6600" opacity="0.5"/>
              <ellipse cx="100" cy="135" rx="30" ry="4" fill="#FF6600" opacity="0.6"/>
            </svg>
          </div>
          <h2>Welcome!</h2>
          <div className="event-info">
            Trivia Night at<br/>
            *venue*<br/>
            *date*
          </div>
          <input
            type="text"
            className="input-field"
            placeholder="ENTER TEAM NAME"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
          />
          <input
            type="text"
            className="input-field"
            placeholder="ENTER GAME CODE"
            value={gameCode}
            onChange={(e) => setGameCode(e.target.value.toUpperCase())}
            maxLength={6}
            style={{ textTransform: 'uppercase' }}
          />
          <button className="submit-button" onClick={handleJoinGame}>
            SUBMIT
          </button>
        </div>
      )}

      {screen === 'waiting' && (
        <div className="screen">
          <div className="logo">QUIZZLER</div>
          <div className="event-info">
            Trivia Night at<br/>
            *venue*<br/>
            *date*
          </div>
          <div className="team-name">*{teamName}*</div>
          <h2>Waiting for Host<br/>to start game</h2>
          <div className="divider"></div>
          <div className="promo-space">
            *promo space for venue<br/>drink specials*
          </div>
        </div>
      )}

      {screen === 'question' && currentQuestion && (
        <div className="screen">
          <div className="logo">QUIZZLER</div>
          <div className="team-name">*{teamName}*</div>
          <div className="question-header">QUESTION {currentQuestion.number}</div>
          <div className="question-text">{currentQuestion.text}</div>
          <input
            type="text"
            className="input-field"
            placeholder="Your answer"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
          />
          <div className="confidence-label">CONFIDENCE SCORE</div>
          <div className="confidence-grid">
            {Array.from({ length: 15 }, (_, i) => i + 1).map(num => (
              <div
                key={num}
                className={`confidence-box ${
                  team?.usedConfidences.includes(num) ? 'used' : ''
                } ${selectedConfidence === num ? 'selected' : ''}`}
                onClick={() => {
                  if (!team?.usedConfidences.includes(num)) {
                    setSelectedConfidence(num);
                  }
                }}
              >
                {num}
              </div>
            ))}
          </div>
          <button className="submit-button" onClick={handleSubmitAnswer}>
            SUBMIT
          </button>
        </div>
      )}

      {screen === 'answerSubmitted' && (
        <div className="screen">
          <div className="logo">QUIZZLER</div>
          <div className="team-name">*{teamName}*</div>
          <div className="score-display">
            CURRENT SCORE<br/>
            <span className="score-value">*{team?.score || 0}*</span>
          </div>
          <h2>Answer sent.<br/>Waiting for host.</h2>
          <div className="divider"></div>
          <div className="promo-space">
            *promo space for venue<br/>drink specials*
          </div>
        </div>
      )}

      {screen === 'correct' && (
        <div className="screen">
          <div className="logo">QUIZZLER</div>
          <div className="team-name">*{teamName}*</div>
          <div className="score-display">
            CURRENT SCORE<br/>
            <span className="score-value">*{team?.score || 0}*</span>
          </div>
          <div className="event-info">
            *Q{currentQuestion?.number}*<br/>
            *{currentQuestion?.text}*<br/>
            *correct answer*
          </div>
          <div className="correct-text">CORRECT!</div>
          <div className="feedback-icon">✓</div>
        </div>
      )}

      {screen === 'incorrect' && (
        <div className="screen">
          <div className="logo">QUIZZLER</div>
          <div className="team-name">*{teamName}*</div>
          <div className="score-display">
            CURRENT SCORE<br/>
            <span className="score-value">*{team?.score || 0}*</span>
          </div>
          <div className="event-info">
            *Q{currentQuestion?.number}*<br/>
            *{currentQuestion?.text}*<br/>
            *correct answer*
          </div>
          <div className="incorrect-text">INCORRECT</div>
          <div className="feedback-icon" style={{ color: '#C60404' }}>✗</div>
        </div>
      )}

      {screen === 'finalQuestion' && (
        <div className="screen">
          <div className="logo">QUIZZLER</div>
          <div className="team-name">*{teamName}*</div>
          <h2>FINAL QUESTION</h2>
          <div className="question-text">{currentQuestion?.text}</div>
          <input
            type="text"
            className="input-field"
            placeholder="Your answer"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
          />
          <div className="confidence-label">WAGER 1-20</div>
          <input
            type="number"
            className="input-field"
            placeholder="Enter wager (0-20)"
            value={wager}
            onChange={(e) => setWager(e.target.value)}
            min="0"
            max="20"
          />
          <button className="submit-button" onClick={handleSubmitAnswer}>
            SUBMIT
          </button>
        </div>
      )}

      {screen === 'gameComplete' && (
        <div className="screen">
          <div className="logo" style={{ fontSize: '56px' }}>QUIZZLER</div>
          <div className="team-name">*{teamName}*</div>
          <div className="placement-text">
            Your team finished in<br/>
            *{getPlacement(game?.leaderboard, teamName)}* place!
          </div>
          <div className="confidence-label">FINAL SCORES</div>
          <div className="leaderboard">
            {game?.leaderboard?.map((t, idx) => (
              <div key={idx} className="leaderboard-item">
                {idx + 1}. {t.name}
              </div>
            ))}
          </div>
          <button 
            className="submit-button" 
            onClick={() => setScreen('thankYou')}
            style={{ marginTop: '30px' }}
          >
            CONTINUE
          </button>
        </div>
      )}

      {screen === 'thankYou' && (
        <div className="screen">
          <div className="logo">QUIZZLER</div>
          <div className="icon">
            <svg className="icon-svg" viewBox="0 0 200 200">
              <circle cx="100" cy="40" r="20" fill="#FF6600"/>
              <text x="100" y="50" textAnchor="middle" fill="white" fontSize="28" fontWeight="bold">?</text>
              <rect x="95" y="60" width="10" height="40" fill="#FF6600"/>
              <ellipse cx="100" cy="120" rx="60" ry="10" fill="#FF6600" opacity="0.3"/>
              <ellipse cx="100" cy="125" rx="50" ry="8" fill="#FF6600" opacity="0.4"/>
              <ellipse cx="100" cy="130" rx="40" ry="6" fill="#FF6600" opacity="0.5"/>
              <ellipse cx="100" cy="135" rx="30" ry="4" fill="#FF6600" opacity="0.6"/>
            </svg>
          </div>
          <div className="thank-you">
            THANK YOU FOR<br/>PLAYING
          </div>
          <div className="event-info">
            Trivia Night at<br/>
            *venue*<br/>
            *date*
          </div>
          <div className="see-you">SEE YOU NEXT WEEK!</div>
        </div>
      )}
    </div>
  );
}

function getPlacement(leaderboard, teamName) {
  if (!leaderboard) return '?';
  const index = leaderboard.findIndex(t => t.name === teamName);
  if (index === -1) return '?';
  const place = index + 1;
  if (place === 1) return '1st';
  if (place === 2) return '2nd';
  if (place === 3) return '3rd';
  return place + 'th';
}