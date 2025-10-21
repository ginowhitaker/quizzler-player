import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'https://quizzler-production.up.railway.app';

export default function PlayerApp() {
  const [socket, setSocket] = useState(null);
  const [screen, setScreen] = useState('join');
  const [gameCode, setGameCode] = useState('');
  const [teamName, setTeamName] = useState('');
  const [teams, setTeams] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [questionNumber, setQuestionNumber] = useState(0);
  const [isFinal, setIsFinal] = useState(false);
  const [answer, setAnswer] = useState('');
  const [selectedConfidence, setSelectedConfidence] = useState(null);
  const [usedConfidences, setUsedConfidences] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [answerResult, setAnswerResult] = useState(null); // null, 'correct', or 'incorrect'
  const [wasCorrect, setWasCorrect] = useState(null);

  useEffect(() => {
    const newSocket = io(BACKEND_URL, {
      transports: ['websocket', 'polling']
    });
    
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to backend');
    });

    newSocket.on('error', (error) => {
      console.error('Socket error:', error);
      alert(error.message);
    });

    return () => newSocket.close();
  }, []);

  useEffect(() => {
    if (!socket) return;

    socket.on('player:joined', (data) => {
      console.log('Joined game:', data);
      setTeams(data.teams);
      const myTeam = data.teams.find(t => t.name === teamName);
      setUsedConfidences(myTeam?.usedConfidences || []);
      
      if (data.currentQuestion) {
        setCurrentQuestion(data.currentQuestion.text);
        setQuestionNumber(data.currentQuestion.number);
        setIsFinal(data.currentQuestion.isFinal);
        setScreen('question');
      } else {
        setScreen('waiting');
      }
    });

    socket.on('player:questionReceived', (data) => {
      setCurrentQuestion(data.question);
      setQuestionNumber(data.questionNumber);
      setIsFinal(data.isFinal);
      setAnswer('');
      setSelectedConfidence(null);
      setSubmitted(false);
      setWasCorrect(null);
      setScreen('question');
    });

    socket.on('player:answerSubmitted', () => {
      setSubmitted(true);
      if (!isFinal && selectedConfidence) {
        setUsedConfidences(prev => [...prev, selectedConfidence]);
      }
    });

    socket.on('player:scoresUpdated', (data) => {
      setTeams(data.teams);
    });

    socket.on('player:gameCompleted', (data) => {
      setTeams(data.teams);
      setScreen('completed');
    });

    return () => {
      socket.off('player:joined');
      socket.off('player:questionReceived');
      socket.off('player:answerSubmitted');
      socket.off('player:scoresUpdated');
      socket.off('player:gameCompleted');
    };
  }, [socket, teamName, isFinal, selectedConfidence]);

  const joinGame = () => {
    if (!gameCode || !teamName) {
      alert('Please enter both game code and team name');
      return;
    }
    socket.emit('player:join', { 
      gameCode: gameCode.toUpperCase(), 
      teamName 
    });
  };

  const submitAnswer = () => {
    if (!answer) {
      alert('Please enter an answer');
      return;
    }
    
    if (!isFinal) {
      if (!selectedConfidence || selectedConfidence < 1 || selectedConfidence > 15) {
        alert('Please select a confidence value');
        return;
      }
      if (usedConfidences.includes(selectedConfidence)) {
        alert('You have already used this confidence value');
        return;
      }
    } else {
      if (selectedConfidence === null || selectedConfidence < 0 || selectedConfidence > 20) {
        alert('Please select a wager between 0 and 20');
        return;
      }
    }

    socket.emit('player:submitAnswer', {
      gameCode: gameCode.toUpperCase(),
      teamName,
      answerText: answer,
      confidence: selectedConfidence
    });
  };

  const getLeaderboard = () => {
    return [...teams].sort((a, b) => b.score - a.score);
  };

  const getOrdinal = () => {
    const leaderboard = getLeaderboard();
    const index = leaderboard.findIndex(t => t.name === teamName);
    if (index === -1) return '?';
    const place = index + 1;
    if (place === 1) return '1st';
    if (place === 2) return '2nd';
    if (place === 3) return '3rd';
    return place + 'th';
  };

  // Styles
  const sunburstBg = {
    background: 'radial-gradient(circle at center, #FFD700 0%, #FFA500 50%, #FF6B35 100%)'
  };

  const orangeColor = '#FF6600';
  const tealColor = '#286586';
  const greenColor = '#00AA00';
  const redColor = '#C60404';
  const blueButton = '#32ADE6';

  // Join Screen
  if (screen === 'join') {
    return (
      <div style={{ ...sunburstBg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: 'Gabarito, sans-serif' }}>
        <div style={{ background: 'white', borderRadius: '20px', padding: '40px', maxWidth: '400px', width: '100%', boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }}>
          <h1 style={{ fontFamily: 'Paytone One', fontSize: '48px', color: orangeColor, textAlign: 'center', margin: '0 0 10px 0' }}>QUIZZLER</h1>
          <p style={{ color: tealColor, textAlign: 'center', fontSize: '18px', marginBottom: '30px' }}>Join the Game</p>
          
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', color: tealColor, fontWeight: 'bold', marginBottom: '8px' }}>Game Code</label>
            <input
              type="text"
              placeholder="Enter code"
              value={gameCode}
              onChange={(e) => setGameCode(e.target.value.toUpperCase())}
              maxLength={6}
              style={{ width: '100%', padding: '15px', fontSize: '24px', textAlign: 'center', border: `2px solid ${tealColor}`, borderRadius: '10px', fontFamily: 'monospace', fontWeight: 'bold' }}
            />
          </div>
          
          <div style={{ marginBottom: '30px' }}>
            <label style={{ display: 'block', color: tealColor, fontWeight: 'bold', marginBottom: '8px' }}>Team Name</label>
            <input
              type="text"
              placeholder="Your team name"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              style={{ width: '100%', padding: '15px', fontSize: '18px', border: `2px solid ${tealColor}`, borderRadius: '10px' }}
            />
          </div>
          
          <button
            onClick={joinGame}
            style={{ width: '100%', padding: '18px', fontSize: '20px', fontWeight: 'bold', background: blueButton, color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer' }}
          >
            Join Game
          </button>
        </div>
      </div>
    );
  }

  // Waiting Screen
  if (screen === 'waiting') {
    const leaderboard = getLeaderboard();
    const myScore = teams.find(t => t.name === teamName)?.score || 0;

    return (
      <div style={{ ...sunburstBg, minHeight: '100vh', padding: '20px', fontFamily: 'Gabarito, sans-serif' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          {/* Header */}
          <div style={{ background: 'white', borderRadius: '15px', padding: '20px', marginBottom: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ color: orangeColor, fontSize: '28px', margin: '0', fontFamily: 'Paytone One' }}>{teamName}</h2>
                <p style={{ color: tealColor, margin: '5px 0 0 0' }}>Game: <strong>{gameCode}</strong></p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '14px', color: tealColor }}>Your Score</div>
                <div style={{ fontSize: '36px', fontWeight: 'bold', color: tealColor }}>{myScore}</div>
                <div style={{ fontSize: '14px', color: tealColor }}>{getOrdinal()} Place</div>
              </div>
            </div>
          </div>

          {/* Waiting Message */}
          <div style={{ background: 'white', borderRadius: '15px', padding: '40px', textAlign: 'center', marginBottom: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize: '64px', marginBottom: '20px' }}>⏳</div>
            <h2 style={{ color: tealColor, fontSize: '24px', marginBottom: '10px' }}>Waiting for Next Question...</h2>
            <p style={{ color: '#666', fontSize: '16px' }}>The host will push the question when ready</p>
          </div>

          {/* Leaderboard */}
          <div style={{ background: 'white', borderRadius: '15px', padding: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
            <h3 style={{ color: tealColor, fontSize: '20px', marginBottom: '15px' }}>🏆 Leaderboard</h3>
            {leaderboard.map((team, idx) => (
              <div key={team.name} style={{ 
                background: team.name === teamName ? '#FFF3E0' : '#f5f5f5', 
                padding: '15px', 
                borderRadius: '10px', 
                marginBottom: '10px',
                border: team.name === teamName ? `3px solid ${orangeColor}` : 'none',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#999' }}>#{idx + 1}</span>
                  <span style={{ fontSize: '18px', fontWeight: team.name === teamName ? 'bold' : 'normal', color: tealColor }}>{team.name}</span>
                </div>
                <span style={{ fontSize: '24px', fontWeight: 'bold', color: orangeColor }}>{team.score}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Question Screen
  if (screen === 'question' && !submitted) {
    const myScore = teams.find(t => t.name === teamName)?.score || 0;
    const confidenceOptions = isFinal 
      ? Array.from({ length: 21 }, (_, i) => i)
      : Array.from({ length: 15 }, (_, i) => i + 1);

    return (
      <div style={{ ...sunburstBg, minHeight: '100vh', padding: '20px', fontFamily: 'Gabarito, sans-serif' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          {/* Header */}
          <div style={{ background: 'white', borderRadius: '15px', padding: '20px', marginBottom: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '14px', color: tealColor }}>{isFinal ? 'FINAL QUESTION!' : `Question ${questionNumber}`}</div>
                <h2 style={{ color: orangeColor, fontSize: '24px', margin: '5px 0 0 0', fontFamily: 'Paytone One' }}>{teamName}</h2>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '14px', color: tealColor }}>Score</div>
                <div style={{ fontSize: '32px', fontWeight: 'bold', color: tealColor }}>{myScore}</div>
              </div>
            </div>
          </div>

          {/* Question */}
          <div style={{ background: isFinal ? '#FFF9C4' : 'white', border: isFinal ? `4px solid ${orangeColor}` : 'none', borderRadius: '15px', padding: '30px', marginBottom: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
            <p style={{ fontSize: '22px', fontWeight: 'bold', color: tealColor, textAlign: 'center', margin: 0 }}>{currentQuestion}</p>
          </div>

          {/* Answer Input */}
          <div style={{ background: 'white', borderRadius: '15px', padding: '20px', marginBottom: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
            <label style={{ display: 'block', color: tealColor, fontWeight: 'bold', marginBottom: '10px', fontSize: '18px' }}>Your Answer</label>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Type your answer here..."
              style={{ width: '100%', padding: '15px', fontSize: '16px', border: `2px solid ${tealColor}`, borderRadius: '10px', minHeight: '80px', resize: 'vertical' }}
            />
          </div>

          {/* Confidence Grid */}
          <div style={{ background: 'white', borderRadius: '15px', padding: '20px', marginBottom: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
            <label style={{ display: 'block', color: tealColor, fontWeight: 'bold', marginBottom: '15px', fontSize: '18px' }}>
              {isFinal ? 'Wager (0-20 points)' : 'Confidence (1-15, each used once)'}
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
              {confidenceOptions.map(num => {
                const isUsed = !isFinal && usedConfidences.includes(num);
                const isSelected = selectedConfidence === num;
                return (
                  <button
                    key={num}
                    onClick={() => !isUsed && setSelectedConfidence(num)}
                    disabled={isUsed}
                    style={{
                      padding: '20px',
                      fontSize: '20px',
                      fontWeight: 'bold',
                      border: isSelected ? `3px solid ${orangeColor}` : '2px solid #ddd',
                      borderRadius: '10px',
                      background: isUsed ? '#e0e0e0' : isSelected ? '#FFE0B2' : 'white',
                      color: isUsed ? '#999' : tealColor,
                      cursor: isUsed ? 'not-allowed' : 'pointer',
                      textDecoration: isUsed ? 'line-through' : 'none'
                    }}
                  >
                    {num}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Submit Button */}
          <button
            onClick={submitAnswer}
            style={{ width: '100%', padding: '20px', fontSize: '22px', fontWeight: 'bold', background: blueButton, color: 'white', border: 'none', borderRadius: '15px', cursor: 'pointer', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}
          >
            Submit Answer
          </button>
        </div>
      </div>
    );
  }

  // Submitted Screen
  if (screen === 'question' && submitted) {
    const myScore = teams.find(t => t.name === teamName)?.score || 0;

    // Show result if answer was marked
    if (answerResult) {
      const isCorrect = answerResult === 'correct';
      return (
        <div style={{ ...sunburstBg, minHeight: '100vh', padding: '20px', fontFamily: 'Gabarito, sans-serif' }}>
          <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ background: 'white', borderRadius: '15px', padding: '20px', marginBottom: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '14px', color: tealColor }}>{isFinal ? 'FINAL QUESTION' : `Question ${questionNumber}`}</div>
                  <h2 style={{ color: orangeColor, fontSize: '24px', margin: '5px 0 0 0', fontFamily: 'Paytone One' }}>{teamName}</h2>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '14px', color: tealColor }}>Score</div>
                  <div style={{ fontSize: '32px', fontWeight: 'bold', color: tealColor }}>{myScore}</div>
                </div>
              </div>
            </div>

            {/* Result Message */}
            <div style={{ background: 'white', borderRadius: '15px', padding: '40px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
              <div style={{ fontSize: '80px', marginBottom: '20px', color: isCorrect ? greenColor : redColor }}>
                {isCorrect ? '✓' : '✗'}
              </div>
              <h2 style={{ color: isCorrect ? greenColor : redColor, fontSize: '32px', marginBottom: '15px', fontFamily: 'Paytone One' }}>
                {isCorrect ? 'Correct!' : 'Incorrect'}
              </h2>
              <p style={{ color: '#666', fontSize: '18px' }}>
                {isCorrect ? `+${selectedConfidence} points` : isFinal ? `-${selectedConfidence} points` : 'No points'}
              </p>
            </div>
          </div>
        </div>
      );
    }

    // Just submitted, waiting for host to mark
    return (
      <div style={{ ...sunburstBg, minHeight: '100vh', padding: '20px', fontFamily: 'Gabarito, sans-serif' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          {/* Header */}
          <div style={{ background: 'white', borderRadius: '15px', padding: '20px', marginBottom: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '14px', color: tealColor }}>{isFinal ? 'FINAL QUESTION' : `Question ${questionNumber}`}</div>
                <h2 style={{ color: orangeColor, fontSize: '24px', margin: '5px 0 0 0', fontFamily: 'Paytone One' }}>{teamName}</h2>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '14px', color: tealColor }}>Score</div>
                <div style={{ fontSize: '32px', fontWeight: 'bold', color: tealColor }}>{myScore}</div>
              </div>
            </div>
          </div>

          {/* Submitted Message */}
          <div style={{ background: 'white', borderRadius: '15px', padding: '40px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
            <h2 style={{ color: tealColor, fontSize: '28px', marginBottom: '15px', fontFamily: 'Paytone One' }}>Answer Submitted</h2>
            <p style={{ color: '#666', fontSize: '18px', marginBottom: '25px' }}>Waiting for host to review...</p>
            
            <div style={{ background: '#f5f5f5', borderRadius: '10px', padding: '20px', marginTop: '20px' }}>
              <div style={{ fontSize: '14px', color: tealColor, marginBottom: '5px' }}>
                Your {isFinal ? 'Wager' : 'Confidence'}
              </div>
              <div style={{ fontSize: '48px', fontWeight: 'bold', color: orangeColor }}>{selectedConfidence}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Game Complete
  if (screen === 'completed') {
    const leaderboard = getLeaderboard();

    return (
      <div style={{ ...sunburstBg, minHeight: '100vh', padding: '20px', fontFamily: 'Gabarito, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ maxWidth: '600px', width: '100%' }}>
          <div style={{ background: 'white', borderRadius: '20px', padding: '40px', boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }}>
            <div style={{ textAlign: 'center', marginBottom: '30px' }}>
              <div style={{ fontSize: '80px', marginBottom: '10px' }}>🏆</div>
              <h1 style={{ fontFamily: 'Paytone One', fontSize: '42px', color: orangeColor, margin: '0 0 10px 0' }}>Game Over!</h1>
              <p style={{ color: tealColor, fontSize: '20px' }}>Final Results</p>
            </div>

            <div>
              {leaderboard.map((team, idx) => {
                const isWinner = idx === 0;
                const isMyTeam = team.name === teamName;
                
                return (
                  <div key={team.name} style={{ 
                    background: isWinner ? '#FFF9C4' : isMyTeam ? '#E3F2FD' : '#f5f5f5',
                    border: isWinner ? `4px solid ${orangeColor}` : isMyTeam ? `3px solid ${tealColor}` : 'none',
                    padding: '20px',
                    borderRadius: '15px',
                    marginBottom: '15px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                      {isWinner && <span style={{ fontSize: '40px' }}>👑</span>}
                      <div>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: tealColor }}>{team.name}</div>
                        {isWinner && <div style={{ color: orangeColor, fontWeight: 'bold' }}>WINNER!</div>}
                        {isMyTeam && !isWinner && <div style={{ color: tealColor, fontWeight: 'bold' }}>Your Team</div>}
                      </div>
                    </div>
                    <div style={{ fontSize: '36px', fontWeight: 'bold', color: orangeColor }}>{team.score}</div>
                  </div>
                );
              })}
            </div>

            <div style={{ textAlign: 'center', marginTop: '30px', color: '#666', fontSize: '16px' }}>
              Thanks for playing Quizzler!
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}