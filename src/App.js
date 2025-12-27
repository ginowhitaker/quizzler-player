import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { Trophy, Crown, Hourglass, Star, Eye, Timer, Camera, Check, X } from 'lucide-react';


const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'https://quizzler-production.up.railway.app';

export default function PlayerApp() {
  const [socket, setSocket] = useState(null);
  const [screen, setScreen] = useState('join');
  const [gameCode, setGameCode] = useState('');
  const [teamName, setTeamName] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [approvalRequest, setApprovalRequest] = useState(null);
  const [role, setRole] = useState(null);
  const [teams, setTeams] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showCategories, setShowCategories] = useState(false);
  const [venueName, setVenueName] = useState('');
  const [venueSpecials, setVenueSpecials] = useState('');
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [questionNumber, setQuestionNumber] = useState(0);
  const [isVisual, setIsVisual] = useState(false);
  const [imageUrl, setImageUrl] = useState(null);
  const [visualAnswers, setVisualAnswers] = useState(['', '', '', '', '', '']);
  const [isFinal, setIsFinal] = useState(false);
  const [finalCategory, setFinalCategory] = useState('');
  const [wager, setWager] = useState(0);
  const [wagerSubmitted, setWagerSubmitted] = useState(false);
  const [answer, setAnswer] = useState('');
  const [selectedConfidence, setSelectedConfidence] = useState(null);
  const [usedConfidences, setUsedConfidences] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [answerResult, setAnswerResult] = useState(null); // null, 'correct', or 'incorrect'
  const submittedRef = useRef(false);
  // eslint-disable-next-line no-unused-vars
  const [timerDuration, setTimerDuration] = useState(0); // Total timer duration in seconds
  const [timeRemaining, setTimeRemaining] = useState(0); // Current countdown
  const [timerActive, setTimerActive] = useState(false);
  const [showStandings, setShowStandings] = useState(false);
  const [standings, setStandings] = useState([]);

// Removed auto-load of saved game info - fields should be clear on app load

useEffect(() => {
  const newSocket = io(BACKEND_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000
    // REMOVED: forceNew: true
  });
  
  setSocket(newSocket);
  
  newSocket.on('connect', () => {
    console.log('Connected to backend');
    
    // If reconnecting mid-game, rejoin the game room
    if (gameCode && teamName && playerName) {
      console.log('Rejoining game:', gameCode, 'as team:', teamName, 'player:', playerName);
      newSocket.emit('player:join', { gameCode, teamName, playerName });
      
      // Sync game state from backend
      fetch(`${BACKEND_URL}/api/game/${gameCode}`)  // FIXED: Added opening (
        .then(res => res.json())
        .then(gameData => {
          console.log('Synced player game state:', gameData);
          
          // Find this team's data
          const myTeam = gameData.teams?.find(t => t.name === teamName);
          if (myTeam) {
            setUsedConfidences(myTeam.usedConfidences || []);
            
            // Check if there's feedback or a current question waiting
            const currentQ = gameData.currentQuestion;
            if (currentQ && currentQ.number) {
              const questionKey = `q${currentQ.number}`;
              const myAnswer = myTeam.answers?.[questionKey];
              
              if (myAnswer?.marked) {
                // Show feedback if answer was already marked
                setAnswerResult(myAnswer.correct ? 'correct' : 'incorrect');
                setScreen('feedback');
              } else if (myAnswer && !myAnswer.marked) {
                // Waiting for host to review
                setSubmitted(true);
                setScreen('waiting');
              }
            }
          }
        })
        .catch(err => console.error('Failed to sync player state:', err));
    }
  });
  
  newSocket.on('disconnect', () => {
    console.log('Disconnected from backend - attempting to reconnect...');
  });
  
  newSocket.on('reconnect', (attemptNumber) => {
    console.log('Reconnected after', attemptNumber, 'attempts');
  });
  
  newSocket.on('error', (error) => {
    console.error('Socket error:', error);
    alert(error.message);
  });
  
  return () => newSocket.close();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

  useEffect(() => {
    if (!socket) return;

socket.on('player:joined', (data) => {
  console.log('Joined game:', data);
  setRole(data.role); // ADD THIS LINE
  setTeams(data.teams);
  setCategories(data.categories || []); // Store categories
  // eslint-disable-next-line no-unused-vars
  const myTeam = data.teams.find(t => t.name === teamName);
  setUsedConfidences(data.usedConfidences || []);
  setVenueName(data.venueName || '');
  setVenueSpecials(data.venueSpecials || '');
  
  // Save to localStorage for easy rejoin
  localStorage.setItem('quizzler_gameCode', data.gameCode);
  localStorage.setItem('quizzler_teamName', teamName);
  localStorage.setItem('quizzler_playerName', playerName);
  
  if (data.currentQuestion) {
  setCurrentQuestion(data.currentQuestion.text);
  setQuestionNumber(data.currentQuestion.number);
  setIsFinal(data.currentQuestion.isFinal);
  
  // Check if it's a visual round
if (data.currentQuestion.type === 'visual') {
  setIsVisual(true);
  setImageUrl(data.currentQuestion.imageUrl || '');
} else {
  setIsVisual(false);
  setImageUrl(null);
}
  
  // Check if team already submitted answer - show waiting screen instead of question input
  if (data.answerAlreadySubmitted) {
    setSubmitted(true);
    submittedRef.current = true;
  }
  
  setScreen('question');
} else {
  setScreen('waiting');
}
});

socket.on('player:captainChanged', (data) => {
  console.log('Captain changed:', data);
  
  // Check if THIS socket is the new captain
  if (socket.id === data.newCaptainSocketId) {
    setRole('captain');
    setUsedConfidences(data.usedConfidences || []); // Update used confidences
    alert('You are now the team captain!');
  } else {
    setRole('viewer');
  }
});

// NEW: Waiting for captain approval
socket.on('player:waitingApproval', (data) => {
  console.log('Waiting for approval:', data);
  setScreen('waitingApproval');
});

// NEW: Approval granted
socket.on('player:approved', (data) => {
  console.log('Approved!', data);
  // Re-trigger join now that we're approved
  socket.emit('player:join', { 
    gameCode: data.gameCode, 
    teamName: data.teamName,
    playerName: data.playerName
  });
});

// NEW: Approval denied
socket.on('player:denied', (data) => {
  alert(`Request denied: ${data.message}`);
  setScreen('join');
});

// NEW: Captain receives approval requests
socket.on('player:approvalRequest', (data) => {
  console.log('Approval request received:', data);
  setApprovalRequest(data);
});

    socket.on('team:updated', (data) => {
      console.log('Team updated:', data);
      setTeams(data.teams);
    });

    socket.on('game:question', (data) => {
      console.log('Question received:', data);
      setCurrentQuestion(data.question);
      setQuestionNumber(data.questionNumber);
      setIsVisual(data.type === 'visual');
      setImageUrl(data.imageUrl || null);
      setVisualAnswers(['', '', '', '', '', '']);
      setIsFinal(data.isFinal || false);
      setFinalCategory(data.category || '');
      setCorrectAnswer('');
      setAnswer('');
      setSelectedConfidence(null);
      setSubmitted(false);
      submittedRef.current = false;
      setWager(0);
      setWagerSubmitted(false);
      setAnswerResult(null);
      setScreen('question');
    });

    socket.on('answer:scored', (data) => {
      console.log('Answer scored:', data);
      setTeams(data.teams);
      
      // Update usedConfidences from team data
      const myTeam = data.teams?.find(t => t.name === teamName);
      if (myTeam?.usedConfidences) {
        setUsedConfidences(myTeam.usedConfidences);
      }
      
      const isVisualScoring = data.isVisual;
      
      if (isVisualScoring) {
        setAnswerResult({
          isVisual: true,
          visualResults: data.visualResults,
          pointsEarned: data.pointsEarned
        });
      } else {
        setAnswerResult(data.correct ? 'correct' : 'incorrect');
      }
      setCorrectAnswer(data.correctAnswer || '');
      setScreen('results');
    });

    socket.on('game:completed', (data) => {
      console.log('Game completed:', data);
      setTeams(data.teams);
      setScreen('completed');
    });
socket.on('player:finalCategoryReceived', (data) => {
      console.log('Final category received:', data);
      setFinalCategory(data.category);
      setIsFinal(true);
      setScreen('wager');
    });

socket.on('timer:start', (data) => {
  console.log('Timer started:', data);
  setTimerDuration(data.duration);
  setTimeRemaining(data.duration);
  setTimerActive(true);
});

socket.on('timer:stop', () => {
  console.log('Timer stopped');
  setTimerActive(false);
});

socket.on('standings:show', (data) => {
  console.log('Show standings:', data);
  setStandings(data.standings);
  setShowStandings(true);
});

socket.on('standings:hide', () => {
  console.log('Hide standings');
  setShowStandings(false);
});

    return () => {
      socket.off('player:joined');
      socket.off('team:updated');
      socket.off('game:question');
      socket.off('answer:scored');
      socket.off('game:completed');
      socket.off('timer:start');
      socket.off('timer:stop');
      socket.off('standings:show');
      socket.off('standings:hide');
    };
  }, [socket, teamName, playerName]);

// Timer countdown effect
useEffect(() => {
  if (!timerActive || timeRemaining <= 0) return;
  
  const interval = setInterval(() => {
    setTimeRemaining(prev => {
      if (prev <= 1) {
        setTimerActive(false);
        return 0;
      }
      return prev - 1;
    });
  }, 1000);
  
  return () => clearInterval(interval);
}, [timerActive, timeRemaining]);

  const joinGame = () => {
    if (gameCode && teamName && playerName) {
      socket.emit('player:join', { 
        gameCode: gameCode.toUpperCase(), 
        teamName,
        playerName 
      });
    }
  };

  const submitAnswer = () => {
    if (submittedRef.current) return; // Prevent double submission
    
    const finalConfidence = isFinal ? wager : (selectedConfidence || 0);
    
    // For visual rounds, submit all 6 answers as an array
    if (isVisual) {
      if (visualAnswers.every(a => a.trim() === '')) {
        alert('Please enter at least one answer');
        return;
      }
      
      submittedRef.current = true;
      setSubmitted(true);
      
      socket.emit('player:answer', {
        gameCode,
        teamName,
        answer: visualAnswers, // Send array of 6 answers
        confidence: 6, // Visual round is always worth 6 points max
        questionNumber,
        isVisual: true
      });
    } else {
      // Regular question
      if (!answer.trim()) {
        alert('Please enter an answer');
        return;
      }
      
      if (isFinal) {
        if (!wagerSubmitted) {
          alert('Please submit your wager first');
          return;
        }
      } else if (!selectedConfidence) {
        alert('Please select a confidence level');
        return;
      }
      
      submittedRef.current = true;
      setSubmitted(true);
      
      socket.emit('player:answer', {
        gameCode,
        teamName,
        answer,
        confidence: finalConfidence,
        questionNumber,
        isFinal
      });
    }
    
    setScreen('submitted');
  };

const submitWager = () => {
  const currentScore = teams.find(t => t.name === teamName)?.score || 0;
  
  // Wager validation
  if (wager < 0) {
    alert('Wager cannot be negative');
    return;
  }
  if (wager > Math.max(currentScore, 20)) {
    alert(`Maximum wager is ${Math.max(currentScore, 20)} points`);
    return;
  }
  
  // If score is 0 or negative, they can only wager up to 20
  if (currentScore <= 0 && wager > 20) {
    alert('With your current score, maximum wager is 20 points');
    return;
  }
  
  setSelectedConfidence(wager);
  setWagerSubmitted(true);
};

  const getLeaderboard = () => {
    return [...teams].sort((a, b) => b.score - a.score);
  };

  // Colors
  const tealColor = '#286586';
  const orangeColor = '#f97316';
  const blueButton = '#1E88E5';
  
// Sunburst background style
const sunburstBg = {
  backgroundImage: 'url(https://quizzlertrivia.com/img/quizzler-background.png)',
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundAttachment: 'fixed',
  backgroundColor: '#286586'  // Fallback color while image loads
};

// Logo component
const Logo = () => (
  <div style={{ textAlign: 'center', marginBottom: '20px' }}>
    <img 
      src="https://quizzlertrivia.com/img/quizzler-logo-wt.png" 
      alt="Quizzler" 
      style={{ height: '30px', width: 'auto' }}
    />
  </div>
);

// Categories button component
const CategoriesButton = () => {
  if (categories.length === 0) return null;
  
  return (
    <>
      <button
        onClick={() => setShowCategories(true)}
        style={{
          position: 'fixed',
          top: '10px',
          right: '10px',
          background: 'white',
          border: `2px solid ${tealColor}`,
          borderRadius: '10px',
          padding: '8px 15px',
          fontSize: '14px',
          fontWeight: 'bold',
          color: tealColor,
          cursor: 'pointer',
          zIndex: 100,
          fontFamily: 'Gabarito, sans-serif'
        }}
      >
        Categories
      </button>
      
      {showCategories && (
        <div 
          onClick={() => setShowCategories(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'white',
              borderRadius: '20px',
              padding: '30px',
              maxWidth: '400px',
              width: '100%',
              maxHeight: '80vh',
              overflow: 'auto'
            }}
          >
            <h2 style={{ 
              fontFamily: 'Gabarito, sans-serif', 
              fontSize: '24px', 
              color: tealColor, 
              marginBottom: '20px',
              textAlign: 'center'
            }}>
              Tonight's Categories
            </h2>
            <div>
              {categories.map((cat, idx) => (
                <div 
                  key={idx}
                  style={{
                    padding: '12px 15px',
                    background: idx % 2 === 0 ? '#f5f5f5' : 'white',
                    borderRadius: '8px',
                    marginBottom: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}
                >
                  <span style={{ 
                    color: orangeColor, 
                    fontWeight: 'bold',
                    fontSize: '16px'
                  }}>
                    {idx + 1}.
                  </span>
                  <span style={{ fontSize: '16px' }}>{typeof cat === 'object' ? cat.category : cat}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => setShowCategories(false)}
              style={{
                width: '100%',
                marginTop: '20px',
                padding: '12px',
                background: tealColor,
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
};

// Approval request banner for captains
const ApprovalBanner = () => {
  if (!approvalRequest || role !== 'captain') return null;
  
  const handleApprove = () => {
    socket.emit('player:approveRequest', {
      gameCode,
      teamName,
      playerName: approvalRequest.playerName,
      approved: true
    });
    setApprovalRequest(null);
  };
  
  const handleDeny = () => {
    socket.emit('player:approveRequest', {
      gameCode,
      teamName,
      playerName: approvalRequest.playerName,
      approved: false
    });
    setApprovalRequest(null);
  };
  
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      background: '#FFF3E0',
      borderBottom: `3px solid ${orangeColor}`,
      padding: '15px 20px',
      zIndex: 1000,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: '10px'
    }}>
      <div>
        <strong style={{ color: orangeColor }}>{approvalRequest.playerName}</strong>
        <span style={{ color: '#666' }}> wants to join your team</span>
      </div>
      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          onClick={handleApprove}
          style={{
            padding: '8px 20px',
            background: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          Approve
        </button>
        <button
          onClick={handleDeny}
          style={{
            padding: '8px 20px',
            background: '#F44336',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            fontWeight: 'bold',
            cursor: 'pointer'
          }}
        >
          Deny
        </button>
      </div>
    </div>
  );
};

// Standings Overlay Component
const StandingsOverlay = () => {
  if (!showStandings) return null;
  
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.9)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '20px',
        padding: '40px',
        maxWidth: '600px',
        width: '100%',
        boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div style={{ marginBottom: '10px' }}>
            <Trophy size={64} className="text-yellow-500" style={{ display: 'inline-block' }} />
          </div>
          <h2 style={{ 
            fontFamily: 'Gabarito, sans-serif', 
            fontSize: '36px', 
            color: tealColor, 
            margin: '0 0 10px 0' 
          }}>
            Current Standings
          </h2>
        </div>

        <div>
          {standings.map((team, idx) => {
            const isMyTeam = team.name === teamName;
            const isFirst = idx === 0;
            
            return (
              <div key={team.name} style={{ 
                background: isFirst ? '#FFF9C4' : isMyTeam ? '#E3F2FD' : '#f5f5f5',
                border: isFirst ? `4px solid ${orangeColor}` : isMyTeam ? `3px solid ${tealColor}` : 'none',
                padding: '20px',
                borderRadius: '15px',
                marginBottom: '15px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <span style={{ 
                    fontSize: '28px', 
                    fontWeight: 'bold', 
                    color: '#999',
                    minWidth: '40px'
                  }}>
                    #{idx + 1}
                  </span>
                  {isFirst && <Crown size={32} className="text-yellow-500" style={{ display: 'inline-block' }} />}
                  <div>
                    <div style={{ 
                      fontSize: '22px', 
                      fontWeight: 'bold', 
                      color: tealColor,
                      fontFamily: 'Gabarito, sans-serif'
                    }}>
                      {team.name}
                    </div>
                    {isMyTeam && (
                      <div style={{ 
                        color: orangeColor, 
                        fontWeight: 'bold',
                        fontSize: '14px'
                      }}>
                        Your Team
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ 
                  fontSize: '36px', 
                  fontWeight: 'bold', 
                  color: orangeColor,
                  fontFamily: 'Gabarito, sans-serif'
                }}>
                  {team.score}
                </div>
              </div>
            );
          })}
        </div>

        <button
          onClick={() => setShowStandings(false)}
          style={{
            width: '100%',
            marginTop: '20px',
            padding: '15px',
            background: tealColor,
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            fontSize: '18px',
            fontWeight: 'bold',
            cursor: 'pointer',
            fontFamily: 'Gabarito, sans-serif'
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
};

  // Join Screen
  if (screen === 'join') {
    return (
      <div style={{ ...sunburstBg, minHeight: '100vh', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '20px', fontFamily: 'Gabarito, sans-serif' }}>
        <div style={{ background: 'white', borderRadius: '20px', padding: '30px', maxWidth: '450px', width: '100%', boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }}>
         <img 
  src="https://quizzlertrivia.com/img/quizzler_logo.png" 
  alt="Quizzler" 
  style={{ height: '30px', width: 'auto', display: 'block', margin: '0 auto 10px' }}
/>
          <p style={{ color: tealColor, textAlign: 'center', fontSize: '18px', marginBottom: '30px' }}>Join the Game</p>
          
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', color: tealColor, fontWeight: 'bold', marginBottom: '8px', fontFamily: 'Gabarito, sans-serif' }}>Game Code</label>
            <input
              type="tel"
              pattern="[0-9]*"
              inputMode="numeric"
              placeholder="Enter code"
              value={gameCode}
              onChange={(e) => setGameCode(e.target.value.toUpperCase())}
              maxLength={4}
              style={{ width: '90%', padding: '15px', fontSize: '24px', textAlign: 'center', border: `2px solid ${tealColor}`, borderRadius: '10px', fontFamily: 'Gabarito, sans-serif', fontWeight: 'bold' }}
            />
          </div>
          
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', color: tealColor, fontWeight: 'bold', marginBottom: '8px', fontFamily: 'Gabarito, sans-serif' }}>Team Name</label>
            <input
              type="text"
              placeholder="Your team name"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              style={{ width: '90%', padding: '15px', fontSize: '18px', border: `2px solid ${tealColor}`, borderRadius: '10px' }}
            />
          </div>

          <div style={{ marginBottom: '30px' }}>
            <label style={{ display: 'block', color: tealColor, fontWeight: 'bold', marginBottom: '8px', fontFamily: 'Gabarito, sans-serif' }}>Your Name</label>
            <input
              type="text"
              placeholder="Your name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              style={{ width: '90%', padding: '15px', fontSize: '18px', border: `2px solid ${tealColor}`, borderRadius: '10px' }}
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

// Waiting for Captain Approval Screen
  if (screen === 'waitingApproval') {
    return (
      <div style={{ ...sunburstBg, minHeight: '100vh', padding: '20px', fontFamily: 'Gabarito, sans-serif' }}>
        <Logo />
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <div style={{ background: 'white', borderRadius: '15px', padding: '40px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
            <div style={{ marginBottom: '20px' }}>
              <Hourglass size={64} className="text-gray-400" style={{ display: 'inline-block' }} />
            </div>
            <h2 style={{ color: tealColor, fontSize: '28px', marginBottom: '15px', fontFamily: 'Gabarito, sans-serif' }}>
              Waiting for Approval
            </h2>
            <p style={{ color: '#666', fontSize: '18px', marginBottom: '10px' }}>
              {playerName}, you've requested to join <strong>{teamName}</strong>
            </p>
            <p style={{ color: '#666', fontSize: '16px' }}>
              The team captain will approve your request shortly...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Waiting Screen
  if (screen === 'waiting') {
    return (
      <>
      <StandingsOverlay />
      <CategoriesButton />
      <div style={{ ...sunburstBg, minHeight: '100vh', padding: '20px', fontFamily: 'Gabarito, sans-serif' }}>
        <Logo />
        <ApprovalBanner />
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          {/* Venue Header with Specials */}
          {venueName && (
            <div style={{ background: 'white', borderRadius: '15px', padding: '20px', marginBottom: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
              <h3 style={{ color: tealColor, fontSize: '20px', marginBottom: '10px', fontFamily: 'Gabarito, sans-serif' }}>{venueName}</h3>
              {venueSpecials && (
                <div style={{ 
                  background: '#FFF3E0', 
                  borderLeft: `4px solid ${orangeColor}`,
                  padding: '15px',
                  borderRadius: '0 10px 10px 0',
                  fontSize: '16px',
                  color: '#333'
                }}>
                  <strong style={{ color: orangeColor }}>Tonight's Specials:</strong>
                  <div style={{ marginTop: '5px', whiteSpace: 'pre-line' }}>{venueSpecials}</div>
                </div>
              )}
            </div>
          )}

          {/* Team/Role Info */}
          <div style={{ background: 'white', borderRadius: '15px', padding: '20px', marginBottom: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ color: orangeColor, fontSize: '28px', margin: '0 0 5px 0', fontFamily: 'Gabarito, sans-serif' }}>{teamName}</h2>
                {role && (
                  <span style={{ 
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '5px 12px', 
                    background: role === 'captain' ? '#FEF3C7' : '#E5E7EB',
                    borderRadius: '20px',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    color: role === 'captain' ? '#D97706' : '#6B7280'
                  }}>
                    {role === 'captain' ? <><Star size={14} /> Captain</> : <><Eye size={14} /> Viewer</>}
                  </span>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '14px', color: tealColor }}>Score</div>
                <div style={{ fontSize: '32px', fontWeight: 'bold', color: tealColor }}>{teams.find(t => t.name === teamName)?.score || 0}</div>
              </div>
            </div>
          </div>

          {/* Leaderboard */}
          <div style={{ background: 'white', borderRadius: '15px', padding: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
            <h3 style={{ color: tealColor, fontSize: '20px', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Trophy size={20} /> Leaderboard
            </h3>
            {getLeaderboard().map((team, idx) => (
              <div key={team.name} style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                padding: '12px',
                background: team.name === teamName ? '#E3F2FD' : idx % 2 === 0 ? '#f9f9f9' : 'white',
                borderRadius: '8px',
                marginBottom: '5px'
              }}>
                <span style={{ color: '#666' }}>#{idx + 1} {team.name}</span>
                <span style={{ fontWeight: 'bold', color: orangeColor }}>{team.score}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      </>
    );
  }

  // Question Screen
  if (screen === 'question') {
    const myScore = teams.find(t => t.name === teamName)?.score || 0;
    const maxWager = Math.max(myScore, 20);
    
    return (
      <>
      <StandingsOverlay />
      <CategoriesButton />
      <div style={{ ...sunburstBg, minHeight: '100vh', padding: '20px', fontFamily: 'Gabarito, sans-serif' }}>
        <Logo />
        <ApprovalBanner />
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          {/* Header */}
          <div style={{ background: 'white', borderRadius: '15px', padding: '20px', marginBottom: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <div>
      <div style={{ fontSize: '14px', color: tealColor }}>
        {isVisual ? 'Visual Round' : isFinal ? 'Final Question' : `Question ${questionNumber}`}
      </div>
      <h2 style={{ color: orangeColor, fontSize: '24px', margin: '5px 0 0 0', fontFamily: 'Gabarito, sans-serif' }}>{teamName}</h2>
      {role && (
        <span style={{ 
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          marginTop: '5px',
          padding: '5px 12px', 
          background: role === 'captain' ? '#FEF3C7' : '#E5E7EB',
          borderRadius: '20px',
          fontSize: '14px',
          fontWeight: 'bold',
          color: role === 'captain' ? '#D97706' : '#6B7280'
        }}>
          {role === 'captain' ? <><Star size={14} /> Captain</> : <><Eye size={14} /> Viewer</>}
        </span>
      )}
    </div>
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontSize: '14px', color: tealColor }}>Score</div>
      <div style={{ fontSize: '32px', fontWeight: 'bold', color: tealColor }}>{myScore}</div>
    </div>
  </div>
</div>

{/* Timer Display */}
{timerActive && timeRemaining > 0 && (
  <div style={{ 
    background: timeRemaining <= 10 ? '#FFEBEE' : 'white', 
    borderRadius: '15px', 
    padding: '15px', 
    marginBottom: '20px', 
    textAlign: 'center',
    boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
    border: timeRemaining <= 10 ? '3px solid #F44336' : 'none'
  }}>
    <div style={{ 
      fontSize: '36px', 
      fontWeight: 'bold', 
      color: timeRemaining <= 10 ? '#F44336' : tealColor,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '10px'
    }}>
      <Timer size={32} /> {Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, '0')}
    </div>
  </div>
)}

          {/* Question Text */}
          <div style={{ background: 'white', borderRadius: '15px', padding: '25px', marginBottom: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
            {isFinal && finalCategory && (
              <div style={{ 
                background: '#FFF3E0', 
                padding: '10px 15px', 
                borderRadius: '10px', 
                marginBottom: '15px',
                textAlign: 'center'
              }}>
                <span style={{ color: orangeColor, fontWeight: 'bold' }}>Category: {finalCategory}</span>
              </div>
            )}
            <p style={{ fontSize: '20px', lineHeight: '1.6', color: '#333', margin: 0 }}>{currentQuestion}</p>
          </div>

          {/* Visual Round Image */}
          {isVisual && imageUrl && (
            <div style={{ background: 'white', borderRadius: '15px', padding: '15px', marginBottom: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
              <img 
                src={imageUrl} 
                alt="Visual Round" 
                style={{ width: '100%', borderRadius: '10px' }}
              />
            </div>
          )}

          {/* Captain Answer Section */}
          {role === 'captain' ? (
            <div style={{ background: 'white', borderRadius: '15px', padding: '25px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
              {isFinal && !wagerSubmitted ? (
                // Final Question Wager Input
                <div>
                  <h3 style={{ color: tealColor, fontSize: '20px', marginBottom: '15px', textAlign: 'center', fontFamily: 'Gabarito, sans-serif' }}>
                    Place Your Wager
                  </h3>
                  <p style={{ color: '#666', textAlign: 'center', marginBottom: '20px' }}>
                    You can wager 0 to {maxWager} points
                  </p>
                  <input
                    type="number"
                    min="0"
                    max={maxWager}
                    value={wager}
                    onChange={(e) => setWager(Math.min(maxWager, Math.max(0, parseInt(e.target.value) || 0)))}
                    style={{ 
                      width: '90%', 
                      padding: '20px', 
                      fontSize: '32px', 
                      textAlign: 'center', 
                      border: `3px solid ${orangeColor}`, 
                      borderRadius: '15px',
                      fontWeight: 'bold',
                      marginBottom: '20px'
                    }}
                  />
                  <button
                    onClick={submitWager}
                    style={{ 
                      width: '100%', 
                      padding: '18px', 
                      fontSize: '20px', 
                      fontWeight: 'bold', 
                      background: orangeColor, 
                      color: 'white', 
                      border: 'none', 
                      borderRadius: '10px', 
                      cursor: 'pointer' 
                    }}
                  >
                    Lock In Wager
                  </button>
                </div>
              ) : isVisual ? (
                // Visual Round - 6 Answer Inputs
                <div>
                  <h3 style={{ color: tealColor, fontSize: '18px', marginBottom: '15px', textAlign: 'center', fontFamily: 'Gabarito, sans-serif' }}>
                    Enter All 6 Answers
                  </h3>
                  {visualAnswers.map((ans, idx) => (
                    <div key={idx} style={{ marginBottom: '12px' }}>
                      <label style={{ display: 'block', color: orangeColor, fontWeight: 'bold', marginBottom: '5px', fontSize: '14px' }}>
                        #{idx + 1}
                      </label>
                      <input
                        type="text"
                        value={ans}
                        onChange={(e) => {
                          const updated = [...visualAnswers];
                          updated[idx] = e.target.value;
                          setVisualAnswers(updated);
                        }}
                        placeholder={`Answer ${idx + 1}`}
                        style={{ 
                          width: '90%', 
                          padding: '12px', 
                          fontSize: '16px', 
                          border: `2px solid ${tealColor}`, 
                          borderRadius: '10px'
                        }}
                      />
                    </div>
                  ))}
                  <button
                    onClick={submitAnswer}
                    disabled={submitted}
                    style={{ 
                      width: '100%', 
                      padding: '18px', 
                      fontSize: '20px', 
                      fontWeight: 'bold', 
                      background: submitted ? '#ccc' : blueButton, 
                      color: 'white', 
                      border: 'none', 
                      borderRadius: '10px', 
                      cursor: submitted ? 'default' : 'pointer',
                      marginTop: '15px'
                    }}
                  >
                    {submitted ? 'Submitted' : 'Submit All Answers'}
                  </button>
                </div>
              ) : (
                // Regular/Final Answer Input
                <div>
                  <h3 style={{ color: tealColor, fontSize: '18px', marginBottom: '15px', textAlign: 'center', fontFamily: 'Gabarito, sans-serif' }}>
                    {isFinal ? `Wager Locked: ${wager} points` : 'Your Answer'}
                  </h3>
                  
                  <input
                    type="text"
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="Type your answer..."
                    style={{ 
                      width: '90%', 
                      padding: '15px', 
                      fontSize: '18px', 
                      border: `2px solid ${tealColor}`, 
                      borderRadius: '10px',
                      marginBottom: '20px'
                    }}
                  />

                  {/* Confidence Selector - Only for regular questions */}
                  {!isFinal && (
                    <div style={{ marginBottom: '20px' }}>
                      <h4 style={{ color: orangeColor, fontSize: '16px', marginBottom: '10px', textAlign: 'center' }}>
                        Choose Confidence (1-15)
                      </h4>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((conf) => {
                          const isUsed = usedConfidences.includes(conf);
                          const isSelected = selectedConfidence === conf;
                          
                          return (
                            <button
                              key={conf}
                              onClick={() => !isUsed && setSelectedConfidence(conf)}
                              disabled={isUsed}
                              style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '10px',
                                border: isSelected ? `3px solid ${orangeColor}` : '2px solid #ddd',
                                background: isUsed ? '#e0e0e0' : isSelected ? '#FFF3E0' : 'white',
                                fontSize: '20px',
                                fontWeight: 'bold',
                                color: isUsed ? '#999' : isSelected ? orangeColor : '#333',
                                cursor: isUsed ? 'not-allowed' : 'pointer',
                                textDecoration: isUsed ? 'line-through' : 'none'
                              }}
                            >
                              {conf}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={submitAnswer}
                    disabled={submitted || (!isFinal && !selectedConfidence)}
                    style={{ 
                      width: '100%', 
                      padding: '18px', 
                      fontSize: '20px', 
                      fontWeight: 'bold', 
                      background: submitted ? '#ccc' : blueButton, 
                      color: 'white', 
                      border: 'none', 
                      borderRadius: '10px', 
                      cursor: submitted ? 'default' : 'pointer' 
                    }}
                  >
                    {submitted ? 'Submitted' : 'Submit Answer'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            // Viewer sees read-only view
            <div style={{ background: 'white', borderRadius: '15px', padding: '25px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
              <div style={{ marginBottom: '15px' }}>
                <Eye size={48} className="text-gray-400" style={{ display: 'inline-block' }} />
              </div>
              <h3 style={{ color: tealColor, fontSize: '20px', marginBottom: '10px', fontFamily: 'Gabarito, sans-serif' }}>
                Viewer Mode
              </h3>
              <p style={{ color: '#666', fontSize: '16px' }}>
                Only the team captain can submit answers.
                <br />Help your team discuss the answer!
              </p>
            </div>
          )}
        </div>
      </div>
      </>
    );
  }

  // Submitted Screen
  if (screen === 'submitted') {
    const myScore = teams.find(t => t.name === teamName)?.score || 0;

    return (
      <>
      <StandingsOverlay />
      <CategoriesButton />
      <div style={{ ...sunburstBg, minHeight: '100vh', padding: '20px', fontFamily: 'Gabarito, sans-serif' }}>
        <Logo />
        <ApprovalBanner />
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          {/* Header */}
<div style={{ background: 'white', borderRadius: '15px', padding: '20px', marginBottom: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <div>
      <div style={{ fontSize: '14px', color: tealColor }}>Question {questionNumber}</div>
      <h2 style={{ color: orangeColor, fontSize: '24px', margin: '5px 0 0 0', fontFamily: 'Gabarito, sans-serif' }}>{teamName}</h2>
      {role && (
          <span style={{ 
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            marginTop: '5px',
            padding: '5px 12px', 
            background: role === 'captain' ? '#FEF3C7' : '#E5E7EB',
            borderRadius: '20px',
            fontSize: '14px',
            fontWeight: 'bold',
            color: role === 'captain' ? '#D97706' : '#6B7280'
          }}>
            {role === 'captain' ? <><Star size={14} /> Captain</> : <><Eye size={14} /> Viewer</>}
          </span>
        )}
    </div>
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontSize: '14px', color: tealColor }}>Score</div>
      <div style={{ fontSize: '32px', fontWeight: 'bold', color: tealColor }}>{myScore}</div>
    </div>
  </div>
</div>

           {/* Submitted Message */}
          <div style={{ background: 'white', borderRadius: '15px', padding: '40px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
            <h2 style={{ color: tealColor, fontSize: '28px', marginBottom: '15px', fontFamily: 'Gabarito, sans-serif' }}>Answer Submitted</h2>
            <p style={{ color: '#666', fontSize: '18px', marginBottom: '25px' }}>Waiting for host to review...</p>
            
            {selectedConfidence > 0 && (
              <div style={{ background: '#f5f5f5', borderRadius: '10px', padding: '20px', marginTop: '20px' }}>
                <div style={{ fontSize: '14px', color: tealColor, marginBottom: '5px' }}>
                  Your {isFinal ? 'Wager' : 'Confidence'}
                </div>
                <div style={{ fontSize: '48px', fontWeight: 'bold', color: orangeColor }}>{selectedConfidence}</div>
              </div>
            )}
          </div>
        </div>
      </div>
      </>
    );
  }

// Results Screen - Show after scoring
if (screen === 'results') {
  const myScore = teams.find(t => t.name === teamName)?.score || 0;
  
  // Handle both regular and visual results
  const isVisualResult = typeof answerResult === 'object' && answerResult.isVisual;
  const pointsEarned = isVisualResult 
    ? answerResult.pointsEarned 
    : (answerResult === 'correct' ? selectedConfidence : 0);
  const wasCorrect = isVisualResult ? pointsEarned > 0 : answerResult === 'correct';
  
  return (
    <>
    <StandingsOverlay />
    <CategoriesButton />
    <div style={{ ...sunburstBg, minHeight: '100vh', padding: '20px', fontFamily: 'Gabarito, sans-serif' }}>
    <Logo />
    <ApprovalBanner />
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ background: 'white', borderRadius: '15px', padding: '20px', marginBottom: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '14px', color: tealColor }}>Question {questionNumber}</div>
              <h2 style={{ color: orangeColor, fontSize: '24px', margin: '5px 0 0 0', fontFamily: 'Gabarito, sans-serif' }}>{teamName}</h2>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '14px', color: tealColor }}>Score</div>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: tealColor }}>{myScore}</div>
            </div>
          </div>
        </div>

        {/* Result Banner */}
        <div style={{ 
          background: wasCorrect ? '#C8E6C9' : '#FFCDD2', 
          border: `4px solid ${wasCorrect ? '#4CAF50' : '#F44336'}`,
          borderRadius: '15px', 
          padding: '30px', 
          marginBottom: '20px', 
          textAlign: 'center',
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
        }}>
          <div style={{ marginBottom: '10px' }}>
            {isVisualResult ? (
              <Camera size={48} style={{ display: 'inline-block' }} />
            ) : wasCorrect ? (
              <Check size={48} className="text-green-600" style={{ display: 'inline-block' }} />
            ) : (
              <X size={48} className="text-red-600" style={{ display: 'inline-block' }} />
            )}
          </div>
          <h2 style={{ 
            fontSize: '28px', 
            margin: '0 0 10px 0', 
            color: wasCorrect ? '#2E7D32' : '#C62828',
            fontFamily: 'Gabarito, sans-serif'
          }}>
            {isVisualResult ? 'VISUAL ROUND SCORED' : (wasCorrect ? 'CORRECT!' : 'INCORRECT')}
          </h2>
          <p style={{ fontSize: '20px', margin: 0, color: wasCorrect ? '#2E7D32' : '#C62828' }}>
            +{pointsEarned} points {isVisualResult ? `(${pointsEarned} of 6 correct)` : ''}
          </p>
        </div>

        {/* Question */}
        <div style={{ background: 'white', borderRadius: '15px', padding: '20px', marginBottom: '15px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
          <div style={{ fontSize: '14px', color: tealColor, marginBottom: '10px', fontWeight: 'bold' }}>Question:</div>
          <p style={{ fontSize: '18px', margin: 0, color: '#333' }}>{currentQuestion}</p>
        </div>

        {/* Your Answer */}
<div style={{ background: '#FFF3E0', borderRadius: '15px', padding: '20px', marginBottom: '15px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
  <div style={{ fontSize: '14px', color: orangeColor, marginBottom: '10px', fontWeight: 'bold' }}>Your Answer{isVisualResult ? 's' : ''}:</div>
  {isVisualResult ? (
    <div>
      {visualAnswers.map((ans, idx) => (
        <div key={idx} style={{ marginBottom: '8px', padding: '8px', background: answerResult.visualResults[idx] ? '#E8F5E9' : '#FFEBEE', borderRadius: '5px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <strong>#{idx + 1}:</strong> {ans} 
          <span style={{ marginLeft: 'auto' }}>
            {answerResult.visualResults[idx] ? (
              <Check size={18} className="text-green-600" />
            ) : (
              <X size={18} className="text-red-600" />
            )}
          </span>
        </div>
      ))}
    </div>
  ) : (
    <p style={{ fontSize: '18px', margin: 0, color: '#333' }}>{answer}</p>
  )}
</div>

{/* Correct Answer */}
{correctAnswer && (
  <div style={{ background: '#E8F5E9', borderRadius: '15px', padding: '20px', marginBottom: '20px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
    <div style={{ fontSize: '14px', color: '#4CAF50', marginBottom: '10px', fontWeight: 'bold' }}>
      {Array.isArray(correctAnswer) ? 'Correct Answers:' : 'Correct Answer:'}
    </div>
    {Array.isArray(correctAnswer) ? (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        {correctAnswer.map((ans, idx) => (
          <div key={idx} style={{ 
            background: answerResult?.visualResults?.[idx] ? '#C8E6C9' : '#FFCDD2',
            padding: '10px', 
            borderRadius: '8px',
            fontSize: '16px',
            color: '#333'
          }}>
            <strong>{idx + 1}.</strong> {ans}
          </div>
        ))}
      </div>
    ) : (
      <p style={{ fontSize: '18px', margin: 0, color: '#333' }}>{correctAnswer}</p>
    )}
  </div>
)}
        {/* Waiting Message - Only show for non-final questions */}
        {!isFinal && (
          <div style={{ background: 'white', borderRadius: '15px', padding: '30px', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
            <div style={{ marginBottom: '15px' }}>
              <Hourglass size={48} className="text-gray-400" style={{ display: 'inline-block' }} />
            </div>
            <p style={{ color: tealColor, fontSize: '18px', margin: 0 }}>Waiting for next question...</p>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
  // Game Complete
  if (screen === 'completed') {
    const leaderboard = getLeaderboard();

    return (
      <>
      <StandingsOverlay />
      <div style={{ ...sunburstBg, minHeight: '100vh', padding: '20px', fontFamily: 'Gabarito, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ maxWidth: '600px', width: '100%' }}>
          <Logo />        
          <div style={{ background: 'white', borderRadius: '20px', padding: '40px', boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }}>
            <div style={{ textAlign: 'center', marginBottom: '30px' }}>
              <div style={{ marginBottom: '10px' }}>
                <Trophy size={80} className="text-yellow-500" style={{ display: 'inline-block' }} />
              </div>
              <h1 style={{ fontFamily: 'Gabarito, sans-serif', fontSize: '42px', color: orangeColor, margin: '0 0 10px 0' }}>Game Over!</h1>
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
                      {isWinner && <Crown size={40} className="text-yellow-500" style={{ display: 'inline-block' }} />}
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
      </>
    );
  }
 
  return null; 
  }