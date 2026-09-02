import { useState, useEffect } from "react";
import { FiUser, FiTrash2, FiEdit, FiSearch, FiList, FiGrid, FiPlus } from "react-icons/fi";
import { FaTrash, FaArchive } from "react-icons/fa";
import Modal from "../components/Modal";
import { MdEditSquare } from "react-icons/md";

export default function Accounts() {
  const [accounts, setAccounts] = useState([]);
  const [isOperating, setIsOperating] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editAccount, setEditAccount] = useState(null);
  const [deleteAccountId, setDeleteAccountId] = useState(null);
  const [formData, setFormData] = useState({ username: '', password: '', role: 'user' });

  useEffect(() => {
    const fetchAccounts = async () => {
      if (isOperating) return;
      try {
        setIsOperating(true);
        const users = await window.api.getUsers();
        setAccounts(users);
      } catch (error) {
        console.error("Error fetching accounts:", error);
        alert("Error loading accounts: " + (error.message || "Unknown error"));
      } finally {
        setIsOperating(false);
      }
    };
    fetchAccounts();
  }, []);

  const handleAddEditAccount = async () => {
    if (isOperating) return;
    if (!formData.username || (!editAccount && !formData.password)) {
      alert("Username and password are required");
      return;
    }
    try {
      setIsOperating(true);
      const data = { ...formData, id: editAccount ? editAccount.id : undefined };
      const result = await window.api.saveUser(data);
      if (result.success) {
        if (editAccount) {
          setAccounts(accounts.map((acc) => (acc.id === editAccount.id ? { ...acc, ...formData } : acc)));
        } else {
          setAccounts([...accounts, { ...formData, id: result.id }]);
        }
        setShowAddEditModal(false);
        setFormData({ username: '', password: '', role: 'user' });
        setEditAccount(null);
      } else {
        alert(result.message || "Failed to save account");
      }
    } catch (error) {
      console.error("Error saving account:", error);
      alert("Error saving account: " + (error.message || "Unknown error"));
    } finally {
      setIsOperating(false);
    }
  };

  const handleDelete = async () => {
    if (isOperating || !deleteAccountId) return;
    try {
      setIsOperating(true);
      const result = await window.api.deleteUser(deleteAccountId);
      if (result.success) {
        setAccounts(accounts.filter((acc) => acc.id !== deleteAccountId));
        setShowDeleteModal(false);
        setDeleteAccountId(null);
      } else {
        alert(result.message || "Failed to delete account");
      }
    } catch (error) {
      console.error("Error deleting account:", error);
      alert("Error deleting account: " + (error.message || "Unknown error"));
    } finally {
      setIsOperating(false);
    }
  };

  const handleEdit = (account) => {
    setEditAccount(account);
    setFormData({ username: account.username, password: '', role: account.role });
    setShowAddEditModal(true);
  };

  const handleDeletePrompt = (id) => {
    setDeleteAccountId(id);
    setShowDeleteModal(true);
  };

  const filteredAccounts = accounts.filter((account) =>
    account.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const AccountCard = ({ account }) => (
    <div
      className={`bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-200 ${isOperating ? 'opacity-50' : ''}`}
    >
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="bg-teal-50 p-2 rounded-lg flex-shrink-0">
            <FiUser className="w-4 h-4 text-teal-600" />
          </div>
          <div className="flex items-center space-x-1 ml-2 flex-shrink-0">
            <button
              onClick={() => handleEdit(account)}
              className={`p-1.5 rounded-md transition-colors ${isOperating ? 'text-gray-400 cursor-not-allowed' : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'}`}
              title="Edit"
              disabled={isOperating}
            >
              <MdEditSquare className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleDeletePrompt(account.id)}
              className={`p-1.5 rounded-md transition-colors ${isOperating ? 'text-gray-400 cursor-not-allowed' : 'text-gray-400 hover:text-red-600 hover:bg-red-50'}`}
              title="Delete"
              disabled={isOperating}
            >
              <FaTrash className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2 break-words leading-tight">
            {account.username}
          </h3>
          <div className="space-y-2">
            <span className="px-2 py-1 bg-teal-100 text-teal-700 text-xs font-medium rounded-full">
              {account.role.charAt(0).toUpperCase() + account.role.slice(1)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );

  const ListView = ({ accounts }) => (
    <div className="bg-white rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-[#4c4c4c] rounded-lg sticky top-0">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider rounded-bl-md">
                Username
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-white uppercase tracking-wider rounded-br-md">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {accounts.map((account, index) => (
              <tr
                key={account.id}
                className={`hover:bg-gray-50 transition-colors ${isOperating ? 'opacity-50' : ''} ${index % 2 === 0 ? 'bg-white' : 'bg-gray-25'}`}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="bg-teal-50 p-2 rounded-lg mr-3">
                      <FiUser className="w-4 h-4 text-teal-600" />
                    </div>
                    <div className="text-sm font-medium text-gray-900">{account.username}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {account.role.charAt(0).toUpperCase() + account.role.slice(1)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleEdit(account)}
                      className={`p-2 rounded-lg transition-colors ${isOperating ? 'text-gray-400 cursor-not-allowed' : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'}`}
                      title="Edit"
                      disabled={isOperating}
                    >
                      <MdEditSquare className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeletePrompt(account.id)}
                      className={`p-2 rounded-lg transition-colors ${isOperating ? 'text-gray-400 cursor-not-allowed' : 'text-gray-400 hover:text-red-600 hover:bg-red-50'}`}
                      title="Delete"
                      disabled={isOperating}
                    >
                      <FaTrash className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="h-full bg-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="bg-teal-100 p-2 rounded-lg">
              <FiUser className="w-6 h-6 text-teal-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Accounts</h1>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => {
                  setEditAccount(null);
                  setFormData({ username: '', password: '', role: 'user' });
                  setShowAddEditModal(true);
                }}
                className={`px-4 py-2 rounded-lg font-medium transition-colors bg-teal-600 text-white hover:bg-teal-700 ${isOperating ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={isOperating}
              >
                <FiPlus className="inline mr-2" />
                Add Account
              </button>
              <div className="flex bg-white border border-gray-300 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-blue-100 text-teal-600' : 'text-gray-500 hover:text-gray-700'}`}
                  title="Grid View"
                >
                  <FiGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-md transition-colors ${viewMode === 'list' ? 'bg-blue-100 text-teal-600' : 'text-gray-500 hover:text-gray-700'}`}
                  title="List View"
                >
                  <FiList className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search accounts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg focus:outline-none
                  focus:ring-1 focus:ring-blue-500
                  focus:border-blue-500"
              />
            </div>
          </div>
        </div>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center">
            <FiUser className="w-5 h-5 mr-2 text-gray-600" />
            Accounts ({filteredAccounts.length})
          </h2>
        </div>
        {filteredAccounts.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <FiUser className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">
              {searchTerm ? 'No accounts match your search' : 'No accounts found'}
            </p>
            <p className="text-gray-400 text-sm mt-1">
              {searchTerm ? 'Try adjusting your search terms' : 'Create a new account to get started'}
            </p>
          </div>
        ) : (
          <>
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredAccounts.map((account) => (
                  <AccountCard key={account.id} account={account} />
                ))}
              </div>
            ) : (
              <ListView accounts={filteredAccounts} />
            )}
          </>
        )}
      </div>
      {showAddEditModal && (
        <Modal
          title={editAccount ? 'Edit Account' : 'Add Account'}
          onClose={() => {
            setShowAddEditModal(false);
            setEditAccount(null);
            setFormData({ username: '', password: '', role: 'user' });
          }}
          onSave={handleAddEditAccount}
          isSaving={isOperating}
          saveText={editAccount ? 'Update' : 'Add'}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all"
                placeholder="Enter username"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all"
                placeholder={editAccount ? 'Enter new password (optional)' : 'Enter password'}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
        </Modal>
      )}
      {showDeleteModal && (
        <Modal
          title="Confirm Delete"
          type="confirm"
          message="Are you sure you want to delete this account?"
          onClose={() => {
            setShowDeleteModal(false);
            setDeleteAccountId(null);
          }}
          onConfirm={handleDelete}
          isSaving={isOperating}
        />
      )}
    </div>
  );
}