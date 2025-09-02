import React from 'react';
import './MedicineList.css';

const MedicineList = ({ 
  medicines = [], 
  readonly = true, 
  onAction = null,
  canConfirm = false,
  canDeny = false
}) => {
  const handleAction = (medicineId, action) => {
    if (onAction) {
      onAction(medicineId, action);
    }
  };

  if (medicines.length === 0) {
    return (
      <div className="medicine-list medicine-list--empty">
        <p>No medicines reported yet</p>
      </div>
    );
  }

  return (
    <div className={`medicine-list ${!readonly ? 'medicine-list--interactive' : ''}`}>
      {medicines.map((medicine) => (
        <div key={medicine.id} className="medicine-item">
          <span className="medicine-name">{medicine.name}</span>
          
          {!readonly && (
            <div className="medicine-actions">
              <button
                className="action-button action-button--deny"
                onClick={() => handleAction(medicine.id, 'deny')}
                disabled={!canDeny}
              >
                They don't
              </button>
              <button
                className="action-button action-button--confirm"
                onClick={() => handleAction(medicine.id, 'confirm')}
                disabled={!canConfirm}
              >
                They have
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default MedicineList;