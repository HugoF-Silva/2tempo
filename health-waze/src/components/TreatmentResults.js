import React, { useState } from 'react';
import './TreatmentResults.css';

const TreatmentResults = ({ 
  centreName, 
  query, 
  results, 
  onClose, 
  onNewSearch 
}) => {
  const [newQuery, setNewQuery] = useState('');
  const [feedback, setFeedback] = useState(null);

  const handleNewSearch = () => {
    if (newQuery.trim()) {
      onNewSearch(newQuery);
      setNewQuery('');
    }
  };

  const handleFeedback = (type) => {
    setFeedback(type);
    // In real app, send feedback to server
    setTimeout(() => setFeedback(null), 2000);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && newQuery.trim()) {
      handleNewSearch();
    }
  };

  return (
    <div className="treatment-results-overlay">
      <div className="treatment-results">
        {/* Header */}
        <div className="results-header">
          <button className="back-button" onClick={onClose}>←</button>
          <h2 className="results-title">{centreName}</h2>
          <div className="header-spacer"></div>
        </div>

        {/* Query display */}
        <div className="query-display">
          <span className="query-label">You searched:</span>
          <span className="query-text">{query}</span>
        </div>

        {/* Results content */}
        <div className="results-content">
          {results.available ? (
            <div className="results-markdown">
              <h3>{results.title}</h3>
              {results.content && (
                <div dangerouslySetInnerHTML={{ __html: results.content }} />
              )}
              {results.bulletPoints && (
                <ul>
                  {results.bulletPoints.map((point, index) => (
                    <li key={index}>{point}</li>
                  ))}
                </ul>
              )}
              {results.emphasis && (
                <p className="results-emphasis">
                  <strong>{results.emphasis}</strong>
                </p>
              )}
            </div>
          ) : (
            <div className="results-unavailable">
              <p>No information available for this treatment at {centreName}.</p>
            </div>
          )}
        </div>

        {/* Feedback buttons */}
        <div className="feedback-section">
          <span className="feedback-label">Was this helpful?</span>
          <div className="feedback-buttons">
            <button 
              className={`feedback-button ${feedback === 'positive' ? 'active' : ''}`}
              onClick={() => handleFeedback('positive')}
              disabled={feedback !== null}
            >
              👍
            </button>
            <button 
              className={`feedback-button ${feedback === 'negative' ? 'active' : ''}`}
              onClick={() => handleFeedback('negative')}
              disabled={feedback !== null}
            >
              👎
            </button>
          </div>
          {feedback && (
            <span className="feedback-message">Thank you for your feedback!</span>
          )}
        </div>

        {/* New search */}
        <div className="new-search-section">
          <input
            type="text"
            className="new-search-input"
            placeholder="Search another treatment"
            value={newQuery}
            onChange={(e) => setNewQuery(e.target.value)}
            onKeyPress={handleKeyPress}
          />
          <button 
            className="new-search-button"
            onClick={handleNewSearch}
            disabled={!newQuery.trim()}
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
};

export default TreatmentResults;